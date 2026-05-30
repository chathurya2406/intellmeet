import { useEffect, useRef } from "react";

const VideoCard = ({
  stream,
  name,
  muted,
}) => {

  const videoRef = useRef();

  useEffect(() => {

    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }

  }, [stream]);

  return (
    <div className="relative bg-gray-900 rounded-2xl overflow-hidden shadow-xl">

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="w-full h-full object-cover"
      />

      <div className="absolute bottom-2 left-2 bg-black/60 px-3 py-1 rounded-lg text-white text-sm">

        {name}

      </div>

    </div>
  );
};

export default VideoCard;