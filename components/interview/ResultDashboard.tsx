"use client";

import { useState } from "react";

export default function ResultDashboard() {


  const [score] = useState("94%");
  const [rank] = useState("Top 5%");
  const [result] = useState("Selected");


  return (

    <div className="min-h-screen bg-slate-950 p-8 text-white">


      <div className="text-center">


        <h1 className="text-3xl font-bold text-cyan-400">
          AI Interview Result Dashboard
        </h1>


        <p className="mt-3 text-slate-400">
          Complete candidate performance analysis
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
              {score}
            </p>


          </div>


        </div>




        {/* Ranking */}

        <div className="col-span-4">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 text-center">


            <h2 className="text-slate-400">
              Candidate Rank
            </h2>


            <p className="mt-5 text-3xl font-bold text-cyan-400">
              {rank}
            </p>


          </div>


        </div>




        {/* Final Result */}

        <div className="col-span-4">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 text-center">


            <h2 className="text-slate-400">
              Hiring Decision
            </h2>


            <p className="mt-5 text-3xl font-bold text-green-400">
              {result}
            </p>


          </div>


        </div>
        {/* Skill Performance */}

        <div className="col-span-12">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8">


            <h2 className="text-2xl font-bold text-cyan-400">
              Skill Performance Analysis
            </h2>



            <div className="grid grid-cols-4 gap-5 mt-6">


              <div className="rounded-2xl bg-slate-800 p-5 text-center">

                <p className="text-slate-400">
                  Coding Skills
                </p>

                <p className="mt-3 text-3xl font-bold text-green-400">
                  96%
                </p>

              </div>



              <div className="rounded-2xl bg-slate-800 p-5 text-center">

                <p className="text-slate-400">
                  Technical Knowledge
                </p>

                <p className="mt-3 text-3xl font-bold text-cyan-400">
                  94%
                </p>

              </div>



              <div className="rounded-2xl bg-slate-800 p-5 text-center">

                <p className="text-slate-400">
                  Communication
                </p>

                <p className="mt-3 text-3xl font-bold text-purple-400">
                  90%
                </p>

              </div>



              <div className="rounded-2xl bg-slate-800 p-5 text-center">

                <p className="text-slate-400">
                  Problem Solving
                </p>

                <p className="mt-3 text-3xl font-bold text-yellow-400">
                  95%
                </p>

              </div>


            </div>


          </div>


        </div>




        {/* Module Wise Results */}

        <div className="col-span-7">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6">


            <h2 className="text-xl font-bold text-cyan-400">
              Module Performance
            </h2>



            <div className="mt-5 space-y-4">


              <div className="flex justify-between bg-slate-800 p-4 rounded-xl">

                <span>
                  AI Interview Analysis
                </span>

                <span className="text-green-400">
                  94%
                </span>

              </div>



              <div className="flex justify-between bg-slate-800 p-4 rounded-xl">

                <span>
                  Coding Assessment
                </span>

                <span className="text-green-400">
                  96%
                </span>

              </div>



              <div className="flex justify-between bg-slate-800 p-4 rounded-xl">

                <span>
                  Voice Analysis
                </span>

                <span className="text-cyan-400">
                  90%
                </span>

              </div>



              <div className="flex justify-between bg-slate-800 p-4 rounded-xl">

                <span>
                  Security Monitoring
                </span>

                <span className="text-green-400">
                  98%
                </span>

              </div>


            </div>


          </div>


        </div>




        {/* AI Summary */}

        <div className="col-span-5">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6">


            <h2 className="text-xl font-bold text-cyan-400">
              AI Summary
            </h2>


            <p className="mt-5 text-slate-300">

              Candidate demonstrated strong technical
              ability, problem solving skills and
              effective communication.

            </p>


          </div>


        </div>
        {/* AI Hiring Recommendation */}

        <div className="col-span-12">


          <div className="rounded-3xl bg-slate-900 border border-cyan-500 p-8">


            <h2 className="text-2xl font-bold text-cyan-400">
              AI Hiring Recommendation
            </h2>



            <div className="grid grid-cols-3 gap-6 mt-6">


              <div className="rounded-2xl bg-slate-800 p-6">

                <h3 className="text-green-400 font-bold">
                  Recommendation
                </h3>


                <p className="mt-4 text-slate-300">

                  Strongly Recommended for
                  Software Engineering roles.

                </p>


              </div>




              <div className="rounded-2xl bg-slate-800 p-6">

                <h3 className="text-cyan-400 font-bold">
                  Best Roles
                </h3>


                <ul className="mt-4 text-slate-300 space-y-2">

                  <li>• Full Stack Developer</li>
                  <li>• AI Engineer</li>
                  <li>• Software Engineer</li>

                </ul>


              </div>




              <div className="rounded-2xl bg-slate-800 p-6">

                <h3 className="text-purple-400 font-bold">
                  Confidence
                </h3>


                <p className="mt-4 text-4xl font-bold text-green-400">

                  96%

                </p>


              </div>


            </div>


          </div>


        </div>




        {/* Final Candidate Report */}

        <div className="col-span-7">


          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6">


            <h2 className="text-xl font-bold text-cyan-400">
              Final Candidate Report
            </h2>



            <div className="mt-5 space-y-4">


              <div className="bg-slate-800 rounded-xl p-4">
                ✅ All interview rounds completed
              </div>


              <div className="bg-slate-800 rounded-xl p-4">
                ✅ AI evaluation completed
              </div>


              <div className="bg-slate-800 rounded-xl p-4">
                ✅ Security verification passed
              </div>


            </div>


          </div>


        </div>




        {/* Report Download */}

        <div className="col-span-5">


          <div className="rounded-3xl bg-slate-900 border border-cyan-500 p-8 text-center">


            <h2 className="text-xl font-bold">
              Download AI Report
            </h2>


            <p className="mt-4 text-slate-400">

              Generate complete candidate
              interview performance report.

            </p>



            <button
              className="mt-6 bg-cyan-600 px-8 py-3 rounded-xl font-bold hover:bg-cyan-700"
            >

              Download PDF

            </button>


          </div>


        </div>


      </div>


    </div>

  );

}