import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";

const Profile = () => {
  const { user, authFetch } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [profileMsg, setProfileMsg] = useState({ text: "", type: "" });
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState({ text: "", type: "" });
  const [pwLoading, setPwLoading] = useState(false);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileMsg({ text: "", type: "" });
    setProfileLoading(true);
    try {
      const res = await authFetch("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ name, avatar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setProfileMsg({ text: "Profile updated successfully!", type: "success" });
    } catch (err) {
      setProfileMsg({ text: err.message || "Update failed.", type: "error" });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwMsg({ text: "", type: "" });
    if (newPassword.length < 8) {
      setPwMsg({ text: "New password must be at least 8 characters.", type: "error" });
      return;
    }
    setPwLoading(true);
    try {
      const res = await authFetch("/api/auth/change-password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setPwMsg({ text: "Password changed. Please log in again.", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPwMsg({ text: err.message || "Password change failed.", type: "error" });
    } finally {
      setPwLoading(false);
    }
  };

  const msgClass = (type) =>
    type === "success"
      ? "bg-green-900/40 border border-green-600 text-green-300"
      : "bg-red-900/40 border border-red-600 text-red-300";

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#020617] to-blue-950 text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-8">Your Profile</h1>

        {/* Avatar preview */}
        <div className="flex items-center gap-5 mb-10 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold overflow-hidden">
            {avatar ? (
              <img src={avatar} alt="avatar" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; }} />
            ) : (
              user?.name?.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-xl font-semibold">{user?.name}</p>
            <p className="text-gray-400">{user?.email}</p>
            <span className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded-full mt-1 inline-block capitalize">{user?.role}</span>
          </div>
        </div>

        {/* Profile form */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
          <h2 className="text-xl font-semibold mb-6">Edit Profile</h2>
          {profileMsg.text && (
            <div className={`${msgClass(profileMsg.type)} px-4 py-3 rounded-xl mb-4 text-sm`}>{profileMsg.text}</div>
          )}
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                required
                className="w-full bg-gray-800 border border-gray-700 text-white p-3 rounded-xl outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Avatar URL (optional)</label>
              <input
                type="url"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="https://example.com/avatar.png"
                className="w-full bg-gray-800 border border-gray-700 text-white p-3 rounded-xl outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={profileLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {profileLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : "Save Changes"}
            </button>
          </form>
        </div>

        {/* Password form */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-xl font-semibold mb-6">Change Password</h2>
          {pwMsg.text && (
            <div className={`${msgClass(pwMsg.type)} px-4 py-3 rounded-xl mb-4 text-sm`}>{pwMsg.text}</div>
          )}
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 text-white p-3 rounded-xl outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">New Password (min 8 chars)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
                className="w-full bg-gray-800 border border-gray-700 text-white p-3 rounded-xl outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={pwLoading}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {pwLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Changing...</> : "Change Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
