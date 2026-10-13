"use client";

import Link from "next/link";
import {
  ShieldCheck,
  Brain,
  Code2,
  Users,
  ArrowRight,
  Sparkles,
} from "lucide-react";


export default function Home() {

  return (

    <main className="
      min-h-screen
      bg-gradient-to-br
      from-slate-950
      via-green-950
      to-black
      px-6
      py-10
    ">


      <section className="
        mx-auto
        max-w-7xl
      ">


        {/* Navbar */}

        <nav className="
          flex
          items-center
          justify-between
          rounded-2xl
          border
          border-white/10
          bg-white/5
          px-6
          py-4
          backdrop-blur-xl
        ">


          <h1 className="
            text-3xl
            font-bold
            text-white
          ">

            Secure
            <span className="text-green-400">
              Nexus
            </span>

          </h1>



          <Link
            href="/login"
            className="
              rounded-xl
              bg-green-600
              px-6
              py-3
              font-semibold
              text-white
              hover:bg-green-500
            "
          >

            Login

          </Link>


        </nav>





        {/* Hero */}

        <div className="
          mt-20
          grid
          gap-12
          lg:grid-cols-2
          lg:items-center
        ">


          <div>


            <div className="
              inline-flex
              items-center
              gap-2
              rounded-full
              border
              border-green-400/30
              bg-green-400/10
              px-4
              py-2
              text-green-300
            ">

              <Sparkles size={18}/>

              Recruiter and Candidate Interview Platform

            </div>



            <h2 className="
              mt-8
              text-5xl
              font-bold
              leading-tight
              text-white
            ">

              Secure AI Interview
              <span className="text-green-400">
                {" "}Workspace
              </span>

            </h2>



            <p className="
              mt-6
              text-lg
              text-gray-400
            ">

              Create candidate invitations, meet in a live interview room,
              run MCQ and coding assessments, and review browser activity.

            </p>




            <div className="
              mt-8
              flex
              gap-4
            ">


              <Link
                href="/login"
                className="
                  flex
                  items-center
                  gap-2
                  rounded-xl
                  bg-green-600
                  px-6
                  py-3
                  font-semibold
                  text-white
                "
              >

                Start Interview

                <ArrowRight size={20}/>

              </Link>

              <Link
                href="/assessment"
                className="
                  flex
                  items-center
                  gap-2
                  rounded-xl
                  border
                  border-white/10
                  bg-white/10
                  px-6
                  py-3
                  font-semibold
                  text-white
                  hover:bg-white/20
                "
              >

                My Assessments

              </Link>


            </div>


          </div>





          {/* Feature Card */}

          <div className="
            rounded-3xl
            border
            border-white/10
            bg-white/5
            p-8
            backdrop-blur-xl
          ">


            <div className="
              grid
              gap-5
              sm:grid-cols-2
            ">


              <Feature
                icon={<ShieldCheck/>}
                title="Interview Security"
                text="Browser activity review and optional BLE proximity signals"
              />


              <Feature
                icon={<Brain/>}
                title="AI Analysis"
                text="Smart interview performance evaluation"
              />


              <Feature
                icon={<Code2/>}
                title="Coding Test"
                text="Real time coding assessment"
              />


              <Feature
                icon={<Users/>}
                title="Collaboration"
                text="Interactive interview workspace"
              />


            </div>


          </div>


        </div>


      </section>


    </main>

  );
}





function Feature({
  icon,
  title,
  text,
}:{
  icon:React.ReactNode;
  title:string;
  text:string;
}) {


  return (

    <div className="
      rounded-2xl
      bg-black/30
      p-5
    ">


      <div className="
        text-green-400
      ">

        {icon}

      </div>



      <h3 className="
        mt-4
        font-bold
        text-white
      ">

        {title}

      </h3>



      <p className="
        mt-2
        text-sm
        text-gray-400
      ">

        {text}

      </p>


    </div>

  );

}