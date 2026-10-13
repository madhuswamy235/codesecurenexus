"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Brain,
  Code2,
  Database,
  Globe,
  Cloud,
  Cpu,
  Sparkles,
  Mic,
  Send,
} from "lucide-react";

const topics = [
  {
    name: "DSA",
    icon: Code2,
  },
  {
    name: "Python",
    icon: BookOpen,
  },
  {
    name: "Java",
    icon: Cpu,
  },
  {
    name: "DBMS",
    icon: Database,
  },
  {
    name: "Computer Networks",
    icon: Globe,
  },
  {
    name: "Machine Learning",
    icon: Brain,
  },
  {
    name: "Cloud Computing",
    icon: Cloud,
  },
];

export default function AILearningAssistant() {

  const [message, setMessage] = useState("");

  return (

    <div className="min-h-screen bg-slate-950 text-white flex">


      {/* Sidebar */}

      <aside className="w-72 bg-slate-900 border-r border-slate-800 p-6">

        <div className="flex items-center gap-3 mb-8">

          <Sparkles className="text-cyan-400" />

          <h1 className="text-2xl font-bold">
            AI Learning Assistant
          </h1>

        </div>


        <h2 className="text-sm text-slate-400 mb-4">
          Learning Topics
        </h2>


        <div className="space-y-3">

          {topics.map((topic) => {

            const Icon = topic.icon;

            return (

              <button
                key={topic.name}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-800 hover:bg-cyan-600 transition"
              >

                <Icon className="w-5 h-5" />

                <span>
                  {topic.name}
                </span>

              </button>

            );

          })}

        </div>


        <div className="mt-10">

          <h2 className="text-sm text-slate-400 mb-4">
            Quick Actions
          </h2>


          <button className="w-full bg-cyan-600 rounded-xl p-3 mb-3">
            Explain Concept
          </button>


          <button className="w-full bg-slate-800 rounded-xl p-3 mb-3">
            Generate Questions
          </button>


          <button className="w-full bg-slate-800 rounded-xl p-3">
            Practice Coding
          </button>


        </div>


      </aside>


      {/* Main Section */}

      <main className="flex-1 p-6">


        <div className="flex justify-between items-center mb-6">

          <div>

            <h2 className="text-3xl font-bold">
              Learn with AI Mentor
            </h2>

            <p className="text-slate-400 mt-2">
              Prepare for coding interviews and technical rounds.
            </p>

          </div>


          <button className="flex items-center gap-2 bg-cyan-600 px-5 py-3 rounded-xl">

            <Mic className="w-5 h-5"/>

            Voice AI

          </button>


        </div>
        {/* AI Chat Area */}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">


          <div className="h-[450px] overflow-y-auto space-y-5">


            {/* AI Welcome Message */}

            <div className="flex gap-3">


              <div className="bg-cyan-600 p-3 rounded-full">

                <Sparkles className="w-5 h-5" />

              </div>


              <div className="bg-slate-800 rounded-xl p-4 max-w-xl">

                <p>
                  Hello! I am your AI Learning Assistant.
                  Ask me about programming, DSA, CS subjects,
                  interview preparation, or coding problems.
                </p>

              </div>


            </div>



            {/* Learning Cards */}

            <div className="grid grid-cols-2 gap-4">


              <div className="bg-slate-800 rounded-xl p-5">

                <h3 className="font-bold text-lg">
                  Coding Practice
                </h3>

                <p className="text-slate-400 text-sm mt-2">
                  Solve programming problems with AI guidance.
                </p>

              </div>



              <div className="bg-slate-800 rounded-xl p-5">

                <h3 className="font-bold text-lg">
                  Interview Preparation
                </h3>

                <p className="text-slate-400 text-sm mt-2">
                  Practice technical and HR questions.
                </p>

              </div>



              <div className="bg-slate-800 rounded-xl p-5">

                <h3 className="font-bold text-lg">
                  Concept Explanation
                </h3>

                <p className="text-slate-400 text-sm mt-2">
                  Understand difficult topics easily.
                </p>

              </div>



              <div className="bg-slate-800 rounded-xl p-5">

                <h3 className="font-bold text-lg">
                  Learning Roadmap
                </h3>

                <p className="text-slate-400 text-sm mt-2">
                  Get a personalized preparation plan.
                </p>

              </div>


            </div>



          </div>




          {/* Input Section */}

          <div className="flex gap-3 mt-6">


            <input

              value={message}

              onChange={(e)=>setMessage(e.target.value)}

              placeholder="Ask AI anything..."

              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-5 py-3 outline-none"

            />


            <button className="bg-cyan-600 px-5 rounded-xl">

              <Send className="w-5 h-5"/>

            </button>


          </div>


        </div>
        {/* AI Progress Dashboard */}

        <div className="grid grid-cols-3 gap-5 mt-6">


          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">

            <h3 className="font-bold text-lg">
              Interview Readiness
            </h3>

            <p className="text-4xl font-bold text-cyan-400 mt-3">
              82%
            </p>

            <p className="text-slate-400 text-sm mt-2">
              Technical preparation score
            </p>

          </div>



          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">

            <h3 className="font-bold text-lg">
              Learning Streak
            </h3>

            <p className="text-4xl font-bold text-green-400 mt-3">
              12 Days
            </p>

            <p className="text-slate-400 text-sm mt-2">
              Continuous learning progress
            </p>

          </div>



          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">

            <h3 className="font-bold text-lg">
              AI Recommendations
            </h3>

            <p className="text-slate-400 mt-3">
              Improve DSA, System Design and Communication Skills.
            </p>

          </div>


        </div>



        {/* Learning Roadmap */}

        <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl p-6">


          <h3 className="text-xl font-bold mb-4">
            Personalized AI Learning Roadmap
          </h3>


          <div className="space-y-3">


            <div className="bg-slate-800 rounded-xl p-4">

              ✅ Complete DSA Advanced Problems

            </div>


            <div className="bg-slate-800 rounded-xl p-4">

              ✅ Practice Machine Learning Concepts

            </div>


            <div className="bg-slate-800 rounded-xl p-4">

              ✅ Prepare System Design Questions

            </div>


            <div className="bg-slate-800 rounded-xl p-4">

              ✅ Take AI Mock Interviews

            </div>


          </div>


        </div>


      </main>


    </div>

  );

}