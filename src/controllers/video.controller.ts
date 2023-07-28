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
      const info = await ytdl.getInfo(url);

      const audioFormat = ytdl.chooseFormat(info.formats, { filter: 'audioonly' });

      const videoDurationLimit = 40
      const isDurationRight = isAudioDurationUnder(audioFormat, videoDurationLimit)

      if (!isDurationRight) return res.json({ ok: false, message: "Video duration longer than " + videoDurationLimit + " minutes" })

      const audioStream = ytdl(url, {
        format: audioFormat,
        filter: 'audioonly',
        quality: 'highestaudio',
      });

      let timeB
      const transcription = await getAudioTranscription(audioStream, timeA, timeB)
      console.log("transcription: " + (Date.now() - timeB) / 1000)

      if (!transcription) {
        console.log("The transcription is empty")
        return res.json({ ok: false, message: "Sorry, we had a problem in the server" })
      }
      console.log("Got the transcription")
      const summary = await getSummary(transcription)
      console.log("total: " + (Date.now() - timeD) / 1000)
      return res.json({
        ok: true,
        result: summary,
        image: getHighQualityThumbnail(info)
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


async function getAudioTranscription(audioStream: Stream, timeA: number, timeB: number): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((res, rej) => {
    audioStream.on('data', (chunk) => chunks.push(chunk));
    audioStream.on('end', async () => {
      console.log("audio stream: " + (Date.now() - timeA) / 1000)
      const audioData = Buffer.concat(chunks);

      // Send the audio data to Deepgram API for transcription
      const API_KEY = '75b9625206cc2af43721900cd61e68250e8ac2ea';
      timeB = Date.now()
      const response = await transcribeAudio(API_KEY, audioData);
      res(response?.results?.channels[0]?.alternatives[0]?.transcript)
    });
    audioStream.on("error", (err) => rej(err))
  })
}

async function transcribeAudio(apiKey: string, audioData: Buffer) {
  const apiUrl = 'https://api.deepgram.com/v1/listen';
  const headers = {
    'Authorization': `Token ${apiKey}`,
    'Content-Type': "audio/mpeg", // Change this to the correct MIME type for your audio data
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: audioData,
  });

  const result = await response.json() as any;
  return result;
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
            content: "You are a web page generator. your resources are: summaries, list items, pieces of advice, interleave them. keep it intriguing. it is forbidden to mention the video/script/keypoint. Put this content in an HTML <body></body> use tags h3, p, ul, li and strong. remember HTML. dont repeat yourself"
          },
          {
            role: "user",
            content: "This is the script: " + transcription
          }
        ]
      })
    })

    const result = await response.json() as any;
    console.log(JSON.stringify(result))
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

  return sections;
}

function isAudioDurationUnder(audioFormat, minutes) {
  const audioDurationInMinutes = audioFormat.approxDurationMs / 1000 / 60;
  return audioDurationInMinutes < minutes;
}

function getHighQualityThumbnail(info: any) {
  const thumbnails = info.videoDetails.thumbnails;
  const highQualityThumbnail = thumbnails.reduce((prev, curr) => {
    if (!prev || curr.width * curr.height > prev.width * prev.height) {
      return curr;
    }
    return prev;
  });

  return highQualityThumbnail.url;
}