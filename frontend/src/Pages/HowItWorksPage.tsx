import React from 'react';
import { Download, Send, Check, User } from 'lucide-react';

export default function HowItWorksPage() {
  const steps = [
    {
      icon: Download,
      alt: "Institutions issue certificates",
      titleTop: "Institutions",
      titleBottom: "Issue Certificates",
    },
    {
      icon: Send,
      alt: "Employers request access",
      titleTop: "Employers",
      titleBottom: "Request Access",
    },
    {
      icon: Check,
      alt: "Applicants approve request",
      titleTop: "Applicants",
      titleBottom: "Approve Request",
    },
    {
      icon: User,
      alt: "Employers verify instantly",
      titleTop: "Employers",
      titleBottom: "Verify Instantly",
    },
  ];

  return (
    <section className="bg-white -mt-6 md:-mt-10">
      <div className="mx-auto max-w-6xl px-6 pt-8 md:pt-10 pb-14 md:pb-16">
        {/* Heading */}
        <h2 className="text-center text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
          How it{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            works
          </span>
        </h2>
        <p className="text-center text-slate-600 mb-10">
        </p>

        {/* Steps with connecting lines */}
        <div className="relative">
          {/* Connecting line - hidden on mobile */}
          <div className="hidden md:block absolute top-20 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-200 via-purple-200 to-indigo-200" 
               style={{ left: '12.5%', right: '12.5%' }} />
          
          <div className="grid gap-8 md:grid-cols-4 relative">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="relative">
                  
                  <div className="relative group">
                    {/* Step number circle - positioned above card */}
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                      <div className="relative">
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg ring-4 ring-white group-hover:scale-110 transition-transform duration-300">
                          <Icon className="h-7 w-7 text-white" />
                        </div>
                        {/* Pulse effect on hover */}
                        <div className="absolute inset-0 rounded-full bg-indigo-400 opacity-0 group-hover:opacity-20 group-hover:animate-ping" />
                      </div>
                    </div>

                    {/* Card */}
                    <div className="pt-14 pb-8 px-6 bg-white rounded-2xl shadow-md border border-slate-200 group-hover:shadow-xl group-hover:border-indigo-300 transition-all duration-300 h-full">
                      {/* Step label */}
                      <div className="text-center mb-3">
                        <span className="inline-block px-3 py-1 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 text-xs font-semibold rounded-full">
                          STEP {i + 1}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-xl font-bold text-slate-900 text-center leading-tight">
                        {step.titleTop}
                        <br />
                        {step.titleBottom}
                      </h3>

                      {/* Decorative gradient bar */}
                      <div className="mt-6 mx-auto w-12 h-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}