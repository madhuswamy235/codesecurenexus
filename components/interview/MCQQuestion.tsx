"use client";

import { useState } from "react";

import {
  Brain,
  Clock,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";


const questions = [

  {
    question:"Which language is mainly used for React development?",
    options:[
      "Python",
      "JavaScript",
      "Java",
      "C++"
    ],
    answer:"JavaScript"
  },


  {
    question:"What does API stand for?",
    options:[
      "Application Programming Interface",
      "Advanced Program Input",
      "Application Private Interface",
      "Applied Program Internet"
    ],
    answer:"Application Programming Interface"
  },


  {
    question:"Which database is commonly used with MERN stack?",
    options:[
      "MongoDB",
      "MySQL",
      "Oracle",
      "Firebase"
    ],
    answer:"MongoDB"
  },


  {
    question:"What is TypeScript?",
    options:[
      "Typed programming language",
      "Database",
      "Browser",
      "Operating System"
    ],
    answer:"Typed programming language"
  }


];



export default function MCQQuestion(){


  const [current,setCurrent]=useState(0);


  const [selected,setSelected]=useState<string[]>([]);


  const [score,setScore]=useState<number|null>(null);



  const selectOption=(option:string)=>{


    const updated=[...selected];

    updated[current]=option;

    setSelected(updated);


  };
  const nextQuestion=()=>{


    if(current < questions.length-1){

      setCurrent(current+1);

    }


  };





  const previousQuestion=()=>{


    if(current > 0){

      setCurrent(current-1);

    }


  };






  const submitTest=()=>{


    let total=0;


    selected.forEach((item,index)=>{


      if(item===questions[index].answer){

        total++;

      }


    });


    setScore(total);


  };





  return (

    <div className="
      mt-6
      rounded-3xl
      border
      border-white/10
      bg-white/5
      p-6
      backdrop-blur-xl
    ">



      <div className="
        flex
        items-center
        justify-between
      ">


        <div className="
          flex
          items-center
          gap-3
        ">


          <Brain
            className="text-green-400"
            size={28}
          />


          <h2 className="
            text-xl
            font-bold
            text-white
          ">

            AI MCQ Assessment

          </h2>


        </div>





        <div className="
          flex
          items-center
          gap-2
          text-green-400
        ">


          <Clock size={20}/>


          30:00


        </div>


      </div>





      <div className="mt-6">


        <div className="
          flex
          justify-between
          text-gray-400
        ">


          <span>

            Question {current+1}/{questions.length}

          </span>


          <span>

            {Math.round(((current+1)/questions.length)*100)}%

          </span>


        </div>




        <div className="
          mt-3
          h-2
          rounded-full
          bg-white/10
        ">


          <div

            className="
              h-2
              rounded-full
              bg-green-500
            "

            style={{

              width:`${((current+1)/questions.length)*100}%`

            }}

          />


        </div>


      </div>





      <div className="
        mt-8
        rounded-2xl
        bg-black/30
        p-6
      ">


        <h3 className="
          text-lg
          font-semibold
          text-white
        ">


          {questions[current].question}


        </h3>





        <div className="
          mt-5
          space-y-3
        ">



          {
            questions[current].options.map((option)=>(


              <button

                key={option}

                onClick={()=>selectOption(option)}

                className={`
                  w-full
                  rounded-xl
                  border
                  p-4
                  text-left
                  text-white

                  ${
                    selected[current]===option

                    ?

                    "border-green-400 bg-green-500/20"

                    :

                    "border-white/10 bg-white/5"

                  }

                `}

              >

                {option}

              </button>


            ))
          }



        </div>


      </div>
      <div className="
        mt-8
        flex
        justify-between
      ">


        <button

          onClick={previousQuestion}

          disabled={current===0}

          className="
            flex
            items-center
            gap-2
            rounded-xl
            bg-white/10
            px-5
            py-3
            text-white
            disabled:opacity-40
          "

        >

          <ChevronLeft size={20}/>

          Previous

        </button>





        {
          current < questions.length-1

          ?

          <button

            onClick={nextQuestion}

            className="
              flex
              items-center
              gap-2
              rounded-xl
              bg-green-600
              px-5
              py-3
              text-white
            "

          >

            Next

            <ChevronRight size={20}/>

          </button>


          :


          <button

            onClick={submitTest}

            className="
              flex
              items-center
              gap-2
              rounded-xl
              bg-green-600
              px-5
              py-3
              text-white
            "

          >

            <CheckCircle size={20}/>

            Submit

          </button>

        }


      </div>





      {
        score !== null && (

          <div className="
            mt-8
            rounded-2xl
            border
            border-green-500/30
            bg-green-500/10
            p-5
            text-center
          ">


            <CheckCircle

              className="
                mx-auto
                text-green-400
              "

              size={40}

            />


            <h3 className="
              mt-3
              text-xl
              font-bold
              text-white
            ">

              Assessment Completed

            </h3>


            <p className="
              mt-2
              text-green-400
            ">

              Score: {score}/{questions.length}

            </p>


          </div>

        )
      }



    </div>

  );

}