"use client";

import { useState } from "react";

export default function AIAnalysis() {


  const [overallScore] = useState("94%");
  const [decision] = useState("Strong Candidate");


  return (

    <div className="min-h-screen bg-slate-950 p-8 text-white">


      <div className="text-center">


        <h1 className="text-3xl font-bold text-cyan-400">
          AI Interview Analysis
        </h1>


        <p className="mt-3 text-slate-400">
          Intelligent evaluation of candidate performance
        </p>


      </div>




      <div className="grid grid-cols-12 gap-6 mt-8">


        {/* Overall Score */}

        <div className="col-span-4">


          <div className="rounded-3xl bg-slate-900 border border-cyan-500 p-8 text-center">


            <h2 className="text-slate-400">
              Overall AI Score
            </h2>


            <p className="mt-5 text-5xl font-bold text-green-400">
              {overallScore}
            </p>


          </div>


        </div>




        {/* Decision */}

        <div className="col-span-4">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 text-center">


            <h2 className="text-slate-400">
              AI Recommendation
            </h2>


            <p className="mt-5 text-2xl font-bold text-cyan-400">
              {decision}
            </p>


          </div>


        </div>




        {/* Analysis Status */}

        <div className="col-span-4">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 text-center">


            <h2 className="text-slate-400">
              Analysis Status
            </h2>


            <p className="mt-5 text-2xl font-bold text-green-400">
              Completed
            </p>


          </div>


        </div>
        {/* Answer Evaluation */}

        <div className="col-span-12">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8">


            <h2 className="text-2xl font-bold text-cyan-400">
              AI Answer Evaluation
            </h2>



            <div className="grid grid-cols-4 gap-5 mt-6">



              <div className="rounded-2xl bg-slate-800 p-5 text-center">

                <p className="text-slate-400">
                  Answer Accuracy
                </p>

                <p className="mt-3 text-3xl font-bold text-green-400">
                  95%
                </p>

              </div>



              <div className="rounded-2xl bg-slate-800 p-5 text-center">

                <p className="text-slate-400">
                  Technical Knowledge
                </p>

                <p className="mt-3 text-3xl font-bold text-cyan-400">
                  93%
                </p>

              </div>



              <div className="rounded-2xl bg-slate-800 p-5 text-center">

                <p className="text-slate-400">
                  Problem Solving
                </p>

                <p className="mt-3 text-3xl font-bold text-purple-400">
                  96%
                </p>

              </div>



              <div className="rounded-2xl bg-slate-800 p-5 text-center">

                <p className="text-slate-400">
                  Explanation Quality
                </p>

                <p className="mt-3 text-3xl font-bold text-yellow-400">
                  90%
                </p>

              </div>


            </div>


          </div>


        </div>




        {/* Communication Analysis */}

        <div className="col-span-6">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6">


            <h2 className="text-xl font-bold text-cyan-400">
              Communication Analysis
            </h2>



            <div className="mt-5 space-y-4">


              <div className="flex justify-between">

                <span>
                  Confidence
                </span>

                <span className="text-green-400">
                  Excellent
                </span>

              </div>



              <div className="flex justify-between">

                <span>
                  Clarity
                </span>

                <span className="text-cyan-400">
                  Very Good
                </span>

              </div>



              <div className="flex justify-between">

                <span>
                  Professional Tone
                </span>

                <span className="text-green-400">
                  Good
                </span>

              </div>


            </div>


          </div>


        </div>




        {/* AI Emotion Analysis */}

        <div className="col-span-6">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6">


            <h2 className="text-xl font-bold text-cyan-400">
              AI Behaviour Analysis
            </h2>


            <div className="mt-5 space-y-4">


              <div className="bg-slate-800 rounded-xl p-4">
                😊 Confidence Level: High
              </div>


              <div className="bg-slate-800 rounded-xl p-4">
                🧠 Stress Detection: Normal
              </div>


              <div className="bg-slate-800 rounded-xl p-4">
                👁 Engagement: Active
              </div>


            </div>


          </div>


        </div>
        {/* AI Recommendation Engine */}

        <div className="col-span-12">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8">


            <h2 className="text-2xl font-bold text-cyan-400">
              AI Recommendation Engine
            </h2>


            <div className="mt-6 grid grid-cols-3 gap-6">


              <div className="rounded-2xl bg-slate-800 p-6">

                <h3 className="font-bold text-green-400">
                  Strengths
                </h3>


                <ul className="mt-4 space-y-2 text-slate-300">

                  <li>✅ Strong technical understanding</li>
                  <li>✅ Good problem solving ability</li>
                  <li>✅ Clear project explanation</li>

                </ul>


              </div>



              <div className="rounded-2xl bg-slate-800 p-6">

                <h3 className="font-bold text-yellow-400">
                  Improvement Areas
                </h3>


                <ul className="mt-4 space-y-2 text-slate-300">

                  <li>⚠ Improve system design skills</li>
                  <li>⚠ Practice advanced algorithms</li>
                  <li>⚠ Give more structured answers</li>

                </ul>


              </div>



              <div className="rounded-2xl bg-slate-800 p-6">

                <h3 className="font-bold text-cyan-400">
                  AI Career Suggestion
                </h3>


                <p className="mt-4 text-slate-300">

                  Recommended roles:
                  Software Engineer,
                  AI Engineer,
                  Full Stack Developer.

                </p>


              </div>


            </div>


          </div>


        </div>




        {/* Final Evaluation */}

        <div className="col-span-7">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6">


            <h2 className="text-xl font-bold text-cyan-400">
              Final Interview Evaluation
            </h2>


            <div className="mt-5 space-y-4">


              <div className="flex justify-between bg-slate-800 p-4 rounded-xl">

                <span>
                  Technical Performance
                </span>

                <span className="text-green-400">
                  Excellent
                </span>

              </div>



              <div className="flex justify-between bg-slate-800 p-4 rounded-xl">

                <span>
                  Communication
                </span>

                <span className="text-cyan-400">
                  Very Good
                </span>

              </div>



              <div className="flex justify-between bg-slate-800 p-4 rounded-xl">

                <span>
                  Hiring Probability
                </span>

                <span className="text-green-400">
                  High
                </span>

              </div>


            </div>


          </div>


        </div>




        {/* Report Generation */}

        <div className="col-span-5">


          <div className="rounded-3xl bg-slate-900 border border-cyan-500 p-8 text-center">


            <h2 className="text-xl font-bold">
              AI Analysis Report
            </h2>


            <p className="mt-4 text-slate-400">

              Complete AI-powered interview
              evaluation report.

            </p>


            <button
              className="mt-6 bg-cyan-600 px-8 py-3 rounded-xl font-bold hover:bg-cyan-700"
            >

              Generate Report

            </button>


          </div>


        </div>


      </div>


    </div>

  );

}