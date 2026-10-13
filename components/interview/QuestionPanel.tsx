"use client";

import { useState } from "react";

import MCQQuestion from "./MCQQuestion";
import CodingQuestion from "./CodingQuestion";


export default function QuestionPanel() {


  const [type, setType] = useState("mcq");



  return (

    <section className="
      rounded-3xl
      border
      border-white/10
      bg-white/5
      p-8
      backdrop-blur-xl
    ">


      <h2 className="
        text-2xl
        font-bold
        text-white
      ">

        AI Question Engine

      </h2>



      <p className="
        mt-2
        text-gray-400
      ">

        Select assessment type

      </p>




      <div className="
        mt-6
        flex
        flex-wrap
        gap-4
      ">


        <button

          onClick={()=>setType("mcq")}

          className="
            rounded-xl
            bg-green-600
            px-5
            py-3
            text-white
          "

        >

          MCQ

        </button>




        <button

          onClick={()=>setType("coding")}

          className="
            rounded-xl
            bg-purple-600
            px-5
            py-3
            text-white
          "

        >

          Coding

        </button>







      </div>





      <div className="mt-8">


        {
          type === "mcq" &&
          <MCQQuestion />
        }



        {
          type === "coding" &&
          <CodingQuestion />
        }





      </div>



    </section>

  );

}