import React, { useState } from "react";

import { useNavigate } from "react-router-dom";

import API from "../services/api";

function Register() {

  const navigate = useNavigate();

  const [formData, setFormData] =
    useState({
      name: "",
      email: "",
      password: "",
    });

  const handleChange = (e) => {

    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {

  e.preventDefault();

  try {

    const response = await API.post(
      "/auth/register",
      formData
    );

    console.log(response.data);

    alert("Registration successful");

  }catch (error) {

  console.log(error.response.data);

  alert(error.response.data.message);
}
};

  return (

    <div className="min-h-screen bg-slate-950 flex justify-center items-center">

      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 p-8 rounded-xl w-96 flex flex-col gap-4"
      >

        <h1 className="text-white text-3xl text-center">

          Register

        </h1>

        <input
          type="text"
          name="name"
          placeholder="Name"
          onChange={handleChange}
          className="p-3 rounded bg-slate-800 text-white"
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          onChange={handleChange}
          className="p-3 rounded bg-slate-800 text-white"
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          onChange={handleChange}
          className="p-3 rounded bg-slate-800 text-white"
        />

        <button
          type="submit"
          className="bg-blue-600 p-3 rounded text-white"
        >
          Register
        </button>

      </form>

    </div>
  );
}

export default Register;