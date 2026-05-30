import React, { useEffect, useRef } from "react";

const VideoPlayer = ({ stream, muted }) => {

  const videoRef = useRef();

  useEffect(() => {

    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }

  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className="w-full h-full rounded-xl bg-black"
    />
  );
};

export default VideoPlayer;