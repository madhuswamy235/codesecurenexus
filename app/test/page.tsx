"use client";

import Link from "next/link";

const modules = [

{
id:1,
name:"Authentication System",
path:"/auth"
},


{
id:3,
name:"User Profile Management",
path:"/profile"
},

{
id:4,
name:"Interview Setup",
path:"/interview/setup"
},

{
id:5,
name:"AI Question Generator",
path:"/interview/questions"
},

{
id:6,
name:"MCQ Question Panel",
path:"/interview/mcq"
},


{
id:8,
name:"Voice Recorder & Analysis",
path:"/interview/voice"
},

{
id:9,
name:"AI Interview Analysis",
path:"/interview/analysis"
},

{
id:10,
name:"Coding Assessment",
path:"/interview/coding"
},

{
id:11,
name:"Collaborative Interview",
path:"/interview/collaborative-interview"
},

{
id:12,
name:"Security Monitor",
path:"/interview/security"
},

{
id:13,
name:"AI Proctoring System",
path:"/interview/proctoring"
},

{
id:14,
name:"Result Dashboard",
path:"/interview/result"
},

{
id:15,
name:"Candidate Report Generator",
path:"/reports"
},


{
id:17,
name:"AI Voice Intelligence",
path:"/ai/voice"
},

{
id:18,
name:"AI Evaluation Engine",
path:"/ai/evaluation"
},

{
id:19,
name:"Real Time Collaboration",
path:"/collaboration"
},

{
id:20,
name:"AI Security Monitoring",
path:"/security"
},

{
id:21,
name:"Advanced AI Analysis",
path:"/ai-analysis"
},

{
id:22,
name:"AI Coding Review",
path:"/code-review"
},

{
id:23,
name:"AI Result Dashboard",
path:"/result-dashboard"
},

{
id:24,
name:"AI Platform Control Center",
path:"/platform-control"
}

];


export default function TestPage(){


return (

<div className="min-h-screen bg-slate-950 p-10 text-white">


<h1 className="text-4xl font-bold text-cyan-400 mb-8">
AI Interview Platform Testing Dashboard
</h1>



<div className="grid md:grid-cols-3 gap-6">


{
modules.map((module)=>(


<Link
href={module.path}
key={module.id}
>


<div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 hover:border-cyan-400 cursor-pointer">


<h2 className="text-xl font-bold">

✅ Module {module.id}

</h2>


<p className="mt-3 text-cyan-300">

{module.name}

</p>


<p className="mt-2 text-sm text-slate-400">

{module.path}

</p>


</div>


</Link>


))

}


</div>


</div>

);

}