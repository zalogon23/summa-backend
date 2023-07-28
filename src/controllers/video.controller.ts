import { Controller, Param, Get, Res } from '@nestjs/common';
import { Response } from "express"
import { Stream } from 'stream';
import "isomorphic-fetch"
const ytdl = require('ytdl-core')

@Controller('video')
export class VideoController {
  @Get(":url")
  async getVideoSummary(@Param('url') url: string, @Res() res: Response) {
    try {
      const timeD = Date.now()
      if (!isValidYouTubeUrl(url)) return res.json({ ok: false, message: "Invalid Youtube URL" })

      const timeA = Date.now()
      const { audioFormat, thumbnails } = await getAudioFormat(url)
      if (audioFormat == null) return res.json({ ok: false, message: "Problem getting video from Youtube." })

      const videoDurationLimit = 40
      const isDurationRight = isAudioDurationUnder(audioFormat, videoDurationLimit)

      if (!isDurationRight) return res.json({ ok: false, message: "Video duration longer than " + videoDurationLimit + " minutes" })

      const audioStream = ytdl(url, {
        format: audioFormat,
        filter: 'audioonly',
        quality: 'highestaudio',
      });

      const { transcription, language } = await getAudioTranscription(audioStream, timeA)
      if (language != "en" && language != "es") return res.json({ ok: false, message: "We only know english and spanish 😢" })

      if (!transcription) {
        console.log("The transcription is empty")
        return res.json({ ok: false, message: "Please try another video, we can't transcript this." })
      }
      console.log("Got the transcription")

      const summary = await getSummary(transcription)
      console.log("total: " + (Date.now() - timeD) / 1000)
      return res.json({
        ok: true,
        result: summary,
        image: getHighQualityThumbnail(thumbnails)
      });
    } catch (err) {
      console.error('Error:', err);
      return res.json({ ok: false, message: 'Sorry, we had a problem in the server' });
    }
  }

  @Get("duration/:url")
  async getVideoDuration(@Param('url') url: string, @Res() res: Response) {
    try {
      if (!isValidYouTubeUrl(url)) return res.json({ ok: false, message: "Invalid Youtube URL" })

      const info = await ytdl.getInfo(url);

      const audioFormat = ytdl.chooseFormat(info.formats, { filter: 'audioonly' });

      return res.json({ ok: true, duration: audioFormat.approxDurationMs / 1000 / 60 })

    } catch (err) {
      console.error('Error:', err);
      return res.json({ ok: false, message: 'Sorry, we had a problem in the server' });
    }
  }
}


async function getAudioTranscription(audioStream: Stream, timeA: number): Promise<any> {
  const chunks: Buffer[] = [];
  const timeB = Date.now()
  return new Promise((res, rej) => {
    audioStream.on('data', (chunk) => chunks.push(chunk));
    audioStream.on('end', async () => {
      console.log("Audio got downloaded and buffered locally: " + (Date.now() - timeA) / 1000)
      const audioData = Buffer.concat(chunks);

      // Send the audio data to Deepgram API for transcription
      const API_KEY = '75b9625206cc2af43721900cd61e68250e8ac2ea';

      const response = await transcribeAudio(API_KEY, audioData);
      console.log("Received transcription from Deepgram in: " + (Date.now() - timeB) / 1000)

      const channel = response?.results?.channels[0]
      const transcription = channel?.alternatives[0]?.transcript
      const language = channel.detected_language
      console.log("Language (Deepgram): " + language)
      console.log(transcription)
      res({ transcription, language })
    });
    audioStream.on("error", (err) => rej(err))
  })
}

async function transcribeAudio(apiKey: string, audioData: Buffer) {
  const apiUrl = 'https://api.deepgram.com/v1/listen?detect_language=true&tier=nova';
  const headers = {
    'Authorization': `Token ${apiKey}`,
    'Content-Type': "audio/mpeg",
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: audioData,
  });

  const result = await response.json() as any;
  return result;
}

async function getAudioFormat(url: string) {
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

async function getSummary(transcription: string) {

  const sections = splitTextIntoSections(transcription, 6000)
  console.log("There are " + sections.length + " sections")

  const API_KEY = "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"

  const promises = sections.map(async (section) => {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo-16k",
        temperature: 0.1,
        max_tokens: 1800,
        messages: [
          {
            role: "system",
            content: "You are a web page generator. your resources are: summaries, list items, pieces of advice, interleave them, use different titles per section. keep it intriguing. never say things like 'in this video'. Put this content in an HTML <body></body> use tags h3, p, ul, li and strong. remember HTML. dont repeat yourself"
          },
          {
            role: "user",
            content: "This is the script: " + transcription
          }
        ]
      })
    })

    const result = await response.json() as any;
    const text = result?.choices[0]?.message?.content || "";
    return text
  })

  const result = (await Promise.all(promises)).join("").replace(/<body>/g, "").replace(/<\/body>/g, "")
  return result
}

function isValidYouTubeUrl(url) {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}/;
  const shortUrlRegex = /^(https?:\/\/)?(www\.)?youtu\.be\/[a-zA-Z0-9_-]{11}/;

  return youtubeRegex.test(url) || shortUrlRegex.test(url);
}

function splitTextIntoSections(text, maxLength) {
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
  console.log(sections.filter(s => !!s))
  return sections.filter(s => !!s);
}

function isAudioDurationUnder(audioFormat, minutes) {
  const audioDurationInMinutes = audioFormat.approxDurationMs / 1000 / 60;
  return audioDurationInMinutes < minutes;
}

function getHighQualityThumbnail(thumbnails: any) {
  const highQualityThumbnail = thumbnails.reduce((prev, curr) => {
    if (!prev || curr.width * curr.height > prev.width * prev.height) {
      return curr;
    }
    return prev;
  });

  return highQualityThumbnail.url;
}