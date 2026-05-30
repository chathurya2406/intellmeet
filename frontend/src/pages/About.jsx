import Navbar from "../components/Navbar";

const About = () => {
  return (

    <div className="min-h-screen bg-gradient-to-br from-black via-[#020617] to-blue-950 text-white">

      <Navbar />

      {/* Hero Section */}

      <div className="flex flex-col items-center justify-center text-center px-6 py-20">

        <h1 className="text-7xl font-bold mb-8">

          About
          <span className="text-blue-500">
            IntellMeet
          </span>

        </h1>

        <p className="text-2xl text-gray-300 max-w-4xl leading-relaxed">

          IntellMeet is a modern real-time video conferencing
          platform built using React, Socket.io and WebRTC.

          It provides secure and high-quality video meetings,
          live chat, screen sharing, and collaboration tools
          for teams, students and organizations.

        </p>

      </div>

      {/* Features Section */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-10 py-16">

        <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-xl">

          <h1 className="text-3xl font-bold text-blue-500 mb-4">

            Video Meetings

          </h1>

          <p className="text-gray-400 text-lg">

            High-quality real-time video conferencing
            with camera and microphone controls.

          </p>

        </div>

        <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-xl">

          <h1 className="text-3xl font-bold text-blue-500 mb-4">

            Live Chat

          </h1>

          <p className="text-gray-400 text-lg">

            Real-time messaging system for smooth
            communication during meetings.

          </p>

        </div>

        <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-xl">

          <h1 className="text-3xl font-bold text-blue-500 mb-4">

            Screen Sharing

          </h1>

          <p className="text-gray-400 text-lg">

            Share presentations, projects and screens
            instantly with participants.

          </p>

        </div>

      </div>

      {/* Contact Section */}

      <div className="px-10 py-20">

        <div className="bg-gray-900 rounded-3xl border border-gray-800 p-12 shadow-2xl">

          <h1 className="text-5xl font-bold text-center mb-12">

            Contact Us

          </h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center">

            {/* Email */}

            <div>

              <h2 className="text-3xl font-semibold text-blue-500 mb-4">

                Email

              </h2>

              <p className="text-gray-300 text-xl">

                support@intellmeet.com

              </p>

            </div>

            {/* Phone */}

            <div>

              <h2 className="text-3xl font-semibold text-blue-500 mb-4">

                Phone

              </h2>

              <p className="text-gray-300 text-xl">

                +91 98xxxxx897

              </p>

            </div>

            {/* Address */}

            <div>

              <h2 className="text-3xl font-semibold text-blue-500 mb-4">

                Address

              </h2>

              <p className="text-gray-300 text-xl">

                Pune, Maharashtra, India

              </p>

            </div>

          </div>

        </div>

      </div>

    </div>

  );
};

export default About;