const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const os = require("os");

const app = express();
const port = 5000;

app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());

// Helper function to get local IP address
const getLocalIPAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
};

// Endpoint to start streaming
app.post("/start-stream", (req, res) => {
  const { videoDevice, audioDevice } = req.body; // Get both video and audio devices from the request body
  const ip = getLocalIPAddress();

  console.log(
    `Starting stream with Video: ${videoDevice}, Audio: ${audioDevice}, IP: ${ip}`
  );

  if (!videoDevice || !audioDevice) {
    return res
      .status(400)
      .send({ error: "Both video and audio devices must be specified" });
  }

  // Command to start FFmpeg streaming with both video and audio
  // const ffmpegCommand = `ffmpeg -f dshow -i video="${videoDevice}":audio="${audioDevice}" -c:v libx264 -preset veryfast -f flv rtmp://${ip}/live/stream`;
  // const ffmpegCommand = `ffmpeg -f dshow -i video="${videoDevice}":audio="${audioDevice}" -s 1280x720 -r 30 -c:v libx264 -preset veryfast -b:v 2500k -maxrate 2500k -bufsize 5000k -c:a aac -b:a 128k -f flv rtmp://${ip}/live/stream`;

  const ffmpegCommand = `ffmpeg -f dshow -i video="${videoDevice}":audio="${audioDevice}" -c:v libx264 -preset veryfast -c:a aac -f flv rtmp://${ip}/live/stream -c copy -f segment -segment_time 10 -reset_timestamps 1 -segment_format mpegts "C:/nginx/html/live/recording%03d.ts"`

  console.log(`Executing FFmpeg command: ${ffmpegCommand}`); // Debugging line

  // Execute the command
  const ffmpegProcess = exec(ffmpegCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error starting FFmpeg: ${error.message}`);
      return res.status(500).send({ error: "Failed to start stream" });
    }
    console.log(`FFmpeg stdout: ${stdout}`);
    console.error(`FFmpeg stderr: ${stderr}`);
    res.send({
      message: "Streaming started successfully",
      url: `http://${ip}:8080/live/stream.m3u8`,
    });
  });

  // Log FFmpeg process output in real-time
  ffmpegProcess.stdout.on("data", (data) => {
    console.log(`FFmpeg stdout: ${data}`);
  });

  ffmpegProcess.stderr.on("data", (data) => {
    console.error(`FFmpeg stderr: ${data}`);
  });
});

// Endpoint to list available cameras and audio devices
app.get("/list-devices", (req, res) => {
  const ffmpegCommand = `ffmpeg -list_devices true -f dshow -i dummy`;

  exec(ffmpegCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error listing devices: ${error.message}`);
      return res.status(500).send({ error: "Failed to list devices" });
    }

    const videoDevices = [];
    const audioDevices = [];
    const lines = stderr.split("\n");

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      // Check if the line contains a video device
      if (trimmedLine.includes("(video)")) {
        const match = trimmedLine.match(/"([^"]+)"/);
        if (match && match[1]) {
          videoDevices.push(match[1]);
        }
      }

      // Check if the line contains an audio device
      if (trimmedLine.includes("(audio)")) {
        const match = trimmedLine.match(/"([^"]+)"/);
        if (match && match[1]) {
          audioDevices.push(match[1]);
        }
      }
    });

    res.send({ videoDevices, audioDevices });
  });
});

app.listen(port, () => {
  console.log(`Streaming server running on http://localhost:${port}`);
});
