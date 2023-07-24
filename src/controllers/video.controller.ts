import { Controller, Param, Get, Res } from '@nestjs/common';
import { Response } from "express"
import { Stream } from 'stream';
import { Configuration, OpenAIApi } from "openai";
import "isomorphic-fetch"
const ytdl = require('ytdl-core')

@Controller('video')
export class VideoController {
  @Get(":url")
  async getVideoSummary(@Param('url') url: string, @Res() res: Response) {
    try {
      const timeD = Date.now()

      const timeA = Date.now()
      const audioStream = ytdl(url, { quality: "highestaudio" });
      console.log("audio stream: " + (Date.now() - timeA) / 1000)

      const timeB = Date.now()
      const transcription = await getAudioTranscription(audioStream)
      console.log("transcription: " + (Date.now() - timeB) / 1000)

      if (!transcription) return res.status(400).json({ error: "The transcription is empty" })
      console.log("Got the transcription")
      const response = await getSummary(transcription)
      console.log("total: " + (Date.now() - timeD) / 1000)
      res.send(response);
    } catch (err) {
      console.error('Error:', err);
      return res.status(500).json({ error: 'An error occurred while downloading the video.' });
    }
  }
}

async function getAudioTranscription(audioStream: Stream): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((res, rej) => {
    audioStream.on('data', (chunk) => chunks.push(chunk));
    audioStream.on('end', async () => {
      const audioData = Buffer.concat(chunks);

      // Send the audio data to Deepgram API for transcription
      const API_KEY = '75b9625206cc2af43721900cd61e68250e8ac2ea';
      const response = await transcribeAudio(API_KEY, audioData);
      res(response?.results?.channels[0]?.alternatives[0]?.transcript)
    });
  })
}

async function transcribeAudio(apiKey: string, audioData: Buffer) {
  const apiUrl = 'https://api.deepgram.com/v1/listen?tier=nova';
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

  const API_KEY = "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"

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
          content: "You are a web page generator. analyze content. go straight to the point, skip intros. summarize each topic. if applicable provide examples on some topics. if applicable write actionable steps derived from the script. keep it intriguing. it is forbidden to mention the video/script/keypoint. Put this content in an HTML <body></body> use tags h3, p, ul, li and strong. remember HTML. dont repeat yourself"
        },
        {
          role: "user",
          content: "This is the script: " + transcription
        }
      ]
    })
  })

  const result = await response.json() as any;
  console.log(result)
  const summary = result.choices[0]?.message?.content || "";
  return { result: formatTextAsHTML(summary) };
}


function formatTextAsHTML(text: string): string {
  return text;
}