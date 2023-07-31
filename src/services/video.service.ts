import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Stream } from 'stream';
const ytdl = require('ytdl-core')
import { UserService } from './user.service';

@Injectable()
export class VideoService {

    constructor(private readonly configService: ConfigService, private readonly userService: UserService) { }

    async getAudioSummary(url: string, id: string) {
        const timeD = Date.now()
        if (!this.isValidYouTubeUrl(url)) return ({ ok: false, message: "Invalid Youtube URL" })

        const timeA = Date.now()
        const { audioFormat, thumbnails } = await this.getAudioFormat(url)
        if (audioFormat == null) return ({ ok: false, message: "Problem getting video from Youtube." })

        const mimeType = audioFormat.mimeType
        console.log(mimeType)

        const coins = Math.floor(this.getDuration(audioFormat))
        const hasEnoughCoinsPreBuffer = await this.userService.hasEnoughCoins(coins, id)

        console.log(`Has enough coins in VideoService.getAudioSummary PreBuffer: ${hasEnoughCoinsPreBuffer}`)
        if (!hasEnoughCoinsPreBuffer) return ({ ok: false, message: "You haven't enough coins for this video. 😢 (" + coins + " coins)" })

        const videoDurationLimit = this.configService.get("DURATION_LIMIT")
        const isDurationRight = this.isAudioDurationUnder(audioFormat, videoDurationLimit)

        if (!isDurationRight) return ({ ok: false, message: "Video duration longer than " + videoDurationLimit + " minutes" })

        const audioStream = await ytdl(url, {
            format: audioFormat,
            filter: 'audioonly',
            quality: 'highestaudio',
        });

        const hasEnoughCoinsPreTranscript = await this.userService.hasEnoughCoins(coins, id)
        console.log(`Has enough coins in VideoService.getAudioSummary Pre Transcipt: ${hasEnoughCoinsPreTranscript}`)
        if (!hasEnoughCoinsPreTranscript) return ({ ok: false, message: "You haven't enough coins for this video. 😢 (" + coins + " coins)" })

        const { transcription, language } = await this.getAudioTranscription(audioStream, timeA, mimeType)

        if (language != "en" && language != "es") return ({ ok: false, message: "We only know english and spanish 😢", paid: coins })

        if (!transcription) {
            console.log("The transcription is empty")
            return ({ ok: false, message: "Please try another video, we can't transcript this.", paid: coins })
        }
        console.log("Got the transcription")

        const summary = await this.getSummary(transcription)

        //After getting the summary you pay.
        const paid = await this.userService.spend(coins, id)
        if (!paid) return ({ ok: false, message: "There was a problem while receiving your coins." })

        console.log("Total: " + (Date.now() - timeD) / 1000)
        return ({
            ok: true,
            result: summary,
            image: this.getHighQualityThumbnail(thumbnails),
            paid: coins
        });
    }

    async getVideoDuration(url: string) {
        if (!this.isValidYouTubeUrl(url)) return ({ ok: false, message: "Invalid Youtube URL" })
        const info = await ytdl.getInfo(url);
        const audioFormat = await ytdl.chooseFormat(info.formats, { filter: 'audioonly' });
        console.log(audioFormat)

        return ({ ok: true, duration: +audioFormat.approxDurationMs / 1000 / 60 })
    }

    async getAudioTranscription(audioStream: Stream, timeA: number, mimeType: string): Promise<any> {
        const chunks: Buffer[] = [];
        const timeB = Date.now()
        return new Promise((res, rej) => {
            audioStream.on('data', (chunk) => chunks.push(chunk));
            audioStream.on('end', async () => {
                console.log("Audio got downloaded and buffered locally: " + (Date.now() - timeA) / 1000)
                const audioData = Buffer.concat(chunks);

                // Send the audio data to Deepgram API for transcription
                const API_KEY = '75b9625206cc2af43721900cd61e68250e8ac2ea';

                const response = await this.transcribeAudio(API_KEY, audioData, mimeType);
                console.log("Received transcription from Deepgram in: " + (Date.now() - timeB) / 1000)

                const channel = response?.results?.channels[0]
                const transcription = channel?.alternatives[0]?.transcript
                const language = channel.detected_language
                console.log("Language (Deepgram): " + language)
                res({ transcription, language })
            });
            audioStream.on("error", (err) => rej(err))
        })
    }

    async transcribeAudio(apiKey: string, audioData: Buffer, mimeType: string) {
        const apiUrl = 'https://api.deepgram.com/v1/listen?detect_language=true&tier=nova&punctuate=true';
        const headers = {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': mimeType,
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: audioData,
        });

        const result = await response.json() as any;
        return result;
    }

    async getAudioFormat(url: string) {
        try {

            const info = await ytdl.getInfo(url);
            const thumbnails = info.videoDetails.thumbnails
            const audioFormat = ytdl.chooseFormat(info.formats, { filter: 'audioonly' });
            return ({ audioFormat, thumbnails })
        } catch (err) {
            console.log(err)
            return null
        }
    }

    async getSummary(transcription: string) {

        const sections = this.splitTextIntoSections(transcription, 20000)
        console.log("There are " + sections.length + " sections")
        console.log(`Transcription length: ${transcription.length}`)

        const API_KEY = "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"

        const promises = sections.map(async (section, id) => {

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo-16k",
                    temperature: 0.1,
                    max_tokens: 1500,
                    messages: [
                        {
                            role: "system",
                            content: "You are a web page generator. your resources are: summaries, list items, pieces of advice, interleave them, use different titles per section. narrate the content as you understand it (dont give your moral opinion). never say things like 'in this video'. Put this content in an HTML <body></body> use tags h3, p, ul, li and strong. remember HTML. dont repeat yourself"
                        },
                        {
                            role: "user",
                            content: "This is the script: " + section
                        }
                    ]
                })
            })

            const result = await response.json() as any;
            console.log(`Result of segment ${id + 1}: ${JSON.stringify(result)}`)
            const text = result?.choices[0]?.message?.content || "";
            return text
        })

        const result = (await Promise.all(promises)).join("").replace(/<body>/g, "").replace(/<\/body>/g, "")
        return result
    }

    isValidYouTubeUrl(url) {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}/;
        const shortUrlRegex = /^(https?:\/\/)?(www\.)?youtu\.be\/[a-zA-Z0-9_-]{11}/;

        return youtubeRegex.test(url) || shortUrlRegex.test(url);
    }

    splitTextIntoSections(text, maxLength) {
        const sentences = text.split('.');
        const sections = [];
        let currentSection = '';

        for (const sentence of sentences) {
            if (currentSection.length + sentence.length + 1 <= maxLength) {
                currentSection += sentence + '.';
            } else {
                sections.push(currentSection);
                currentSection = sentence + '.';
            }
        }

        if (currentSection.trim() !== '') {
            sections.push(currentSection);
        }
        return sections.filter(s => !!s);
    }

    getDuration(audioFormat) {
        return audioFormat.approxDurationMs / 1000 / 60;
    }

    isAudioDurationUnder(audioFormat, minutes) {
        const audioDurationInMinutes = this.getDuration(audioFormat)
        return audioDurationInMinutes < minutes;
    }

    getHighQualityThumbnail(thumbnails: any) {
        const highQualityThumbnail = thumbnails.reduce((prev, curr) => {
            if (!prev || curr.width * curr.height > prev.width * prev.height) {
                return curr;
            }
            return prev;
        });

        return highQualityThumbnail.url;
    }
}
