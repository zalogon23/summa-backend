import { Controller, Param, Get, Res, Headers } from '@nestjs/common';
import { Response } from "express"
import "isomorphic-fetch"
import { VideoService } from 'src/services/video.service';
import { UserService } from 'src/services/user.service';

@Controller('video')
export class VideoController {

  constructor(private readonly userService: UserService, private readonly videoService: VideoService) { }

  @Get(":url")
  async getVideoSummary(@Param('url') url: string, @Headers('Authorization') header: string, @Res() res: Response) {
    try {
      const user = await this.userService.getUser(header)
      const response = await this.videoService.getAudioSummary(url, user.id)
      res.json(response)
    } catch (err) {
      console.error('Error:', err);
      return res.json({ ok: false, message: 'Sorry, we had a problem in the server' });
    }
  }

  @Get("duration/:url")
  async getVideoDuration(@Param('url') url: string, @Res() res: Response) {
    try {
      console.log("eeeeeeeeeeeeeeeeeeee")
      const response = await this.videoService.getVideoDuration(url)
      return res.json(response)
    } catch (err) {
      console.error('Error:', err);
      return res.json({ ok: false, message: 'Sorry, we had a problem in the server' });
    }
  }
}