"use client";

import { useState } from "react";

export default function CodingQuestions() {


  const [language] = useState("Python");
  const [status] = useState("Ready");


  return (

    <div className="min-h-screen bg-slate-950 p-8 text-white">


      <div className="text-center">


        <h1 className="text-3xl font-bold text-cyan-400">
          AI Coding Assessment
        </h1>


        <p className="mt-3 text-slate-400">
          Intelligent coding evaluation and analysis platform
        </p>


      </div>




      <div className="grid grid-cols-12 gap-6 mt-8">


        {/* Question Panel */}

        <div className="col-span-4">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6">


            <h2 className="text-xl font-bold text-cyan-400">
              Coding Problem
            </h2>


            <p className="mt-5 text-slate-300">

              Write a program to find the largest
              element in an array.

            </p>


            <div className="mt-5 bg-slate-800 p-4 rounded-xl">

              Difficulty:
              <span className="text-green-400">
                Medium
              </span>

            </div>


          </div>


        </div>





        {/* Code Editor */}

        <div className="col-span-8">


          <div className="rounded-3xl bg-slate-900 border border-cyan-500 p-6">


            <h2 className="text-xl font-bold text-cyan-400">
              Code Editor
            </h2>


            <div className="mt-5 h-[300px] bg-slate-950 rounded-xl p-5">


              <code className="text-green-400">

                def solution(arr):<br/>
                &nbsp;&nbsp;return max(arr)

              </code>


            </div>


            <div className="mt-5 flex gap-4">


              <button className="bg-green-600 px-6 py-3 rounded-xl">
                ▶ Run Code
              </button>


              <button className="bg-cyan-600 px-6 py-3 rounded-xl">
                Submit
              </button>


            </div>


          </div>


        </div>
        {/* Test Case Evaluation */}

        <div className="col-span-12">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8">


            <h2 className="text-2xl font-bold text-cyan-400">
              Test Case Evaluation
            </h2>


            <div className="grid grid-cols-4 gap-5 mt-6">


              <div className="rounded-2xl bg-slate-800 p-5 text-center">

                <p className="text-slate-400">
                  Total Cases
                </p>

                <p className="text-3xl font-bold mt-3">
                  10
                </p>

              </div>



              <div className="rounded-2xl bg-slate-800 p-5 text-center">

                <p className="text-slate-400">
                  Passed
                </p>

                <p className="text-3xl font-bold text-green-400 mt-3">
                  10
                </p>

              </div>



              <div className="rounded-2xl bg-slate-800 p-5 text-center">

                <p className="text-slate-400">
                  Failed
                </p>

                <p className="text-3xl font-bold text-red-400 mt-3">
                  0
                </p>

              </div>



              <div className="rounded-2xl bg-slate-800 p-5 text-center">

                <p className="text-slate-400">
                  Execution Time
                </p>

                <p className="text-3xl font-bold text-cyan-400 mt-3">
                  120ms
                </p>

              </div>


            </div>


          </div>


        </div>




        {/* AI Code Review */}

        <div className="col-span-7">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6">


            <h2 className="text-xl font-bold text-cyan-400">
              AI Code Review
            </h2>


            <div className="mt-5 space-y-4">


              <div className="bg-slate-800 rounded-xl p-4">
                ✅ Code correctness: Excellent
              </div>


              <div className="bg-slate-800 rounded-xl p-4">
                ✅ Code readability: Good
              </div>


              <div className="bg-slate-800 rounded-xl p-4">
                💡 Suggestion: Optimize memory usage
              </div>


            </div>


          </div>


        </div>




        {/* Complexity Analysis */}

        <div className="col-span-5">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6">


            <h2 className="text-xl font-bold text-cyan-400">
              Complexity Analysis
            </h2>


            <div className="mt-5 space-y-4">


              <div className="bg-slate-800 rounded-xl p-4">
                Time Complexity: O(n)
              </div>


              <div className="bg-slate-800 rounded-xl p-4">
                Space Complexity: O(1)
              </div>


              <div className="bg-green-900 rounded-xl p-4">
                Optimized Solution
              </div>


            </div>


          </div>


        </div>
        {/* AI Plagiarism Detection */}

        <div className="col-span-6">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6">


            <h2 className="text-xl font-bold text-cyan-400">
              AI Plagiarism Detection
            </h2>


            <div className="mt-5 space-y-4">


              <div className="bg-slate-800 rounded-xl p-4 flex justify-between">

                <span>
                  Code Similarity
                </span>

                <span className="text-green-400">
                  5%
                </span>

              </div>


              <div className="bg-slate-800 rounded-xl p-4 flex justify-between">

                <span>
                  External Source Match
                </span>

                <span className="text-green-400">
                  Not Detected
                </span>

              </div>


              <div className="bg-green-900 rounded-xl p-4">

                ✅ Original Solution Verified

              </div>


            </div>


          </div>


        </div>




        {/* Code Quality Score */}

        <div className="col-span-6">


          <div className="rounded-3xl bg-slate-900 border border-cyan-500 p-6">


            <h2 className="text-xl font-bold text-cyan-400">
              AI Code Quality Score
            </h2>


            <div className="text-center mt-6">


              <p className="text-6xl font-bold text-green-400">
                95%
              </p>


              <p className="mt-3 text-slate-400">
                Excellent Coding Performance
              </p>


            </div>


          </div>


        </div>




        {/* Final Coding Report */}

        <div className="col-span-12">


          <div className="rounded-3xl bg-slate-900 border border-cyan-500 p-8 text-center">


            <h2 className="text-2xl font-bold">
              AI Coding Evaluation Report
            </h2>


            <p className="mt-4 text-slate-400">

              Complete analysis of coding ability,
              optimization, correctness, and originality.

            </p>


            <div className="grid grid-cols-4 gap-5 mt-6">


              <div className="bg-slate-800 rounded-xl p-4">
                Accuracy
                <br/>
                <span className="text-green-400">
                  100%
                </span>
              </div>


              <div className="bg-slate-800 rounded-xl p-4">
                Efficiency
                <br/>
                <span className="text-cyan-400">
                  95%
                </span>
              </div>


              <div className="bg-slate-800 rounded-xl p-4">
                Quality
                <br/>
                <span className="text-purple-400">
                  95%
                </span>
              </div>


              <div className="bg-slate-800 rounded-xl p-4">
                Rating
                <br/>
                <span className="text-yellow-400">
                  5/5
                </span>
              </div>


            </div>



            <button
              className="mt-8 bg-cyan-600 px-8 py-3 rounded-xl font-bold hover:bg-cyan-700"
            >
              Generate Coding Report
            </button>


          </div>


        </div>


      </div>


    </div>

  );

}