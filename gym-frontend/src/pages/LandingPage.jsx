import logo from "../assets/logo.png";
import LineWaves from "../components/Line Waves/Line_waves";
import DatabaseConnectivityTest from "../components/common/DatabaseConnectivityTest";
import { useState, useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import { Link } from "react-router-dom";
import {
  Database,
  CheckCircle,
  Shield,
  Zap,
  Users,
  Trophy,
  Star,
  ArrowRight,
  Menu,
  X,
  ChevronDown,
  Clock,
  MapPin,
  Phone,
  Mail,
  Dumbbell,
  Heart,
  Activity,
  Flame,
  Calendar,
  Shirt,
  Award,
} from "lucide-react";

function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeFAQ, setActiveFAQ] = useState(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);


    AOS.init({
      duration: 800,
      once: true,
      offset: 100,
      easing: "ease-out-cubic",
    });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setIsMenuOpen(false);
  };

  const faqs = [
    {
      q: "I'm new to the gym. Where should I start?",
      a: "Start with a simple full-body workout routine 2-3 times a week. Focus on compound exercises like squats, push-ups, rows, and lunges. Don't forget to warm up for 5-10 minutes before each session and cool down with stretches afterward.",
    },
    {
      q: "Do I need a personal trainer as a beginner?",
      a: "Not necessarily, but it can be very helpful. A trainer can teach you proper form, prevent injuries, and create a personalized plan. If a trainer is out of budget, many gyms offer a free introductory session or you can watch trusted YouTube tutorials.",
    },
    {
      q: "How often should I work out each week?",
      a: "For beginners, 3 days per week is a great start. Give your body rest days in between to recover and rebuild muscles. As you get stronger, you can increase to 4-5 days per week.",
    },
    {
      q: "How do I stay consistent with my workouts?",
      a: "Set small, achievable goals. Schedule your workouts like appointments. Find a workout buddy or join group classes. Track your progress seeing small wins keeps you motivated. Remember: showing up is half the battle.",
    },
    {
      q: "Is it normal to feel sore after working out?",
      a: "Yes! That's called DOMS (Delayed Onset Muscle Soreness). It usually peaks 24-48 hours after exercise and is a sign your muscles are adapting. To reduce soreness, stay hydrated, stretch, get enough sleep, and eat protein-rich foods.",
    },
  ];

  const features = [
    {
      icon: Dumbbell,
      title: "Stable Equipment",
      desc: "All the gear inside the gym is well-maintained and working properly.",
    },
    {
      icon: Users,
      title: "Approachable Trainers",
      desc: "Professionals with specialized expertise in bodybuilding, boxing, and weight lifting",
    },
    {
      icon: Clock,
      title: "6AM-12AM Gym Access",
      desc: "Train on your schedule, not ours. Secure QR entry with Attendance Monitoring around the clock.",
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500/30 overflow-x-hidden">


      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
            ? "bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 shadow-lg shadow-black/40"
            : "bg-transparent"
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center justify-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-transparent flex items-center justify-center">
                <img src={logo} alt="Web Logo" />
              </div>
              <span className="text-3xl font-bold tracking-tight">
                <span className="text-light-gold">Capra</span>
                <span className="text-gradient">Fitness</span>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              {["Home", "Programs", "Features", "FAQ"].map((item) => (
                <button
                  key={item}
                  onClick={() => scrollToSection(item.toLowerCase())}
                  className="text-sm text-zinc-400 hover:text-classic-gold transition-colors duration-300 font-medium tracking-wide cursor-pointer"
                >
                  {item}
                </button>
              ))}
              <Link to="/login"
                className="px-5 py-2 bg-gradient text-zinc-950 text-sm font-bold rounded hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-300 hover:scale-105 cursor-pointer"
              >
                Join Now
              </Link>
            </div>

            <button
              className="md:hidden text-zinc-300"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? (
                <X className="w-6 h-6 cursor-pointer" />
              ) : (
                <Menu className="w-6 h-6 cursor-pointer" />
              )}
            </button>
          </div>
        </div>


        {isMenuOpen && (
          <div className="md:hidden bg-zinc-900/98 backdrop-blur-lg border-b border-zinc-800">
            <div className="px-4 py-6 space-y-4">
              {["Home", "Programs", "Features", "FAQ"].map((item) => (
                <button
                  key={item}
                  onClick={() => scrollToSection(item.toLowerCase())}
                  className="block w-full text-left text-zinc-300 hover:text-classic-gold py-2 text-base font-medium transition-colors cursor-pointer"
                >
                  {item}
                </button>
              ))}
              <button
                className="w-full py-3 bg-gradient text-zinc-950 font-bold rounded-xl mt-4 cursor-pointer"
              >
                <Link to="/login">Join Now</Link>
              </button>
            </div>
          </div>
        )}
      </nav>


      <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0 bg-zinc-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-amber-600/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
        <LineWaves
          speed={0.2}
          innerLineCount={11}
          outerLineCount={36}
          warpIntensity={1}
          rotation={-5}
          edgeFadeWidth={0}
          colorCycleSpeed={2.4}
          brightness={0.1}
          color1="#f5e6b3"
          color2="#d9a75b"
          color3="#a86e2a"
          enableMouseInteraction
          mouseInfluence={2}
        />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1
            data-aos="fade-up"
            data-aos-duration="1000"
            className="text-5xl sm:text-6xl md:text-9xl font-bold tracking-tight mb-6"
          >
            <span className="text-zinc-100">Begin Your</span>
            <br />
            <span className="text-gradient">Fitness</span>&nbsp;
            <span className="text-zinc-100">Legacy Today</span>
          </h1>

          <p
            data-aos="fade-up"
            data-aos-delay="200"
            className="text-[14px] sm:text-[18px] lg:text-[20px] text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Join{" "}
            <span className="text-classic-gold font-semibold">
              2100+ members
            </span>{" "}
            who have transformed their lives. Premium equipment, expert
            trainers, and an atmosphere that pushes you beyond limits.
          </p>

          <div
            data-aos="fade-up"
            data-aos-delay="400"
            className="flex flex-col sm:flex-row items-center justify-center gap-4 w-[90%] m-auto sm:w-[50%]"
          >
            <button
              onClick={() => scrollToSection("plans")}
              className="group px-6 py-3 bg-gradient text-zinc-950 font-bold text-md rounded-xl hover:shadow-xl hover:shadow-amber-500/30 transition-all duration-300 hover:scale-105 w-full cursor-pointer"
            >
              <Link to="/register">
                Start Your Transformation
              </Link>
            </button>
            <button
              onClick={() => scrollToSection("features")}
              className="px-6 py-3 border border-zinc-700 text-zinc-300 font-semibold text-md rounded-xl hover:border-dark-bronze hover:text-dark-bronze transition-all duration-300 w-full cursor-pointer bg-soft-dark"
            >
              Explore Features
            </button>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-zinc-600" />
        </div>
      </section>


      <section id="programs" className="py-20 sm:py-28 relative">
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div data-aos="fade-up" className="text-center mb-16">
            <span className="text-gradient text-sm font-bold uppercase tracking-[0.2em]">
              Gym Programs & Events
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-6">
              What's Happening at <span className="text-gradient">Capra</span>
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto text-lg">
              Join our programs, train with experts, and earn exclusive rewards
            </p>
          </div>


          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: Users,
                title: "Personal Trainer",
                description:
                  "One-on-one coaching tailored to your goals. Our certified trainers will push you beyond your limits.",
                features: [
                  "Custom workout plans",
                  "Form correction",
                  "Nutrition guidance",
                ],
                price: "₱200 / session",
                color: "from-soft-dark/20 to-classic-gold/20",
                iconColor: "text-classic-gold",
              },
              {
                icon: Shield,
                title: "Boxing Program",
                description:
                  "Learn proper technique, improve cardio, and release stress with our professional boxing coaches.",
                features: [
                  "Footwork training",
                  "Sparring (optional)",
                  "Fitness conditioning",
                ],
                price: "₱200 / session",
                color: "from-soft-dark/20 to-classic-gold/20",
                iconColor: "text-classic-gold",
              },
              {
                icon: Dumbbell,
                title: "Weight Lifting",
                description:
                  "Build strength and muscle with our powerlifting and bodybuilding programs.",
                features: [
                  "Powerlifting technique",
                  "Strength programming",
                  "Form optimization",
                ],
                price: "₱200 / session",
                color: "from-soft-dark/20 to-classic-gold/20",
                iconColor: "text-classic-gold",
              },
            ].map((program, i) => (
              <div
                key={i}
                data-aos="fade-up"
                data-aos-delay={i * 100}
                className={`group p-6 rounded-2xl bg-gradient-to-br ${program.color} border border-amber-500/20 hover:border-dark-bronze/50 transition-all duration-500 hover:-translate-y-2`}
              >
                <div
                  className={`w-14 h-14 rounded-xl bg-dark-bronze/10 border border-amber-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <program.icon className={`w-7 h-7 ${program.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold text-zinc-100 mb-2">
                  {program.title}
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                  {program.description}
                </p>
                <ul className="space-y-2 mb-4">
                  {program.features.map((feature, fi) => (
                    <li
                      key={fi}
                      className="flex items-center gap-2 text-sm text-zinc-300"
                    >
                      <CheckCircle className="w-4 h-4 text-classic-gold" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-amber-500/20">
                  <span className="text-classic-gold font-bold text-sm">
                    {program.price}
                  </span>
                </div>
              </div>
            ))}
          </div>


          <div
            data-aos="zoom-in"
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-dark-bronze/20 via-pure-black to-dark-bronze/20 border border-amber-500/30 p-8 mb-12"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-amber-500/20 border border-amber-500/40 h items-center justify-center hidden md:flex">
                  <Award className="w-10 h-10 text-classic-gold" />
                </div>
                <div className="text-center md:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient border border-classic-gold mb-2">
                    <Trophy className="w-3 h-3 text-soft-dark" />
                    <span className="text-xs text-soft-dark font-bold uppercase tracking-wider">
                      Every Day Challenge
                    </span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-zinc-100">
                    20-Day&nbsp;
                    <span className="text-gradient">Login Challenge</span>
                  </h3>
                  <p className="text-zinc-400 text-sm mt-2 max-w-md">
                    Check in for 20 consecutive days and earn an exclusive{" "}
                    <span className="text-classic-gold font-bold">
                      Capra Fitness T-Shirt
                    </span>{" "}
                    absolutely free!
                  </p>
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-12 h-12 rounded-lg bg-classic-gold/20 border border-amber-500/40 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-classic-gold" />
                  </div>
                  <span className="text-zinc-400 text-sm">
                    20 days of
                    <br />
                    consistency
                  </span>
                  <ArrowRight className="w-4 h-4 text-amber-400" />
                  <div className="w-12 h-12 rounded-lg bg-gradient flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <Shirt className="w-6 h-6 text-black" />
                  </div>
                  <span className="text-zinc-400 text-sm">
                    free
                    <br />
                    T-Shirt
                  </span>
                </div>
                <h3 className="mt-6 text-gradient font-extrabold">
                  Go to Gym Today!
                </h3>
              </div>
            </div>
          </div>
        </div>
      </section>


      <section id="features" className="py-20 sm:py-28 relative">
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div data-aos="fade-up" className="text-center mb-16">
            <span className="text-gradient text-sm font-bold uppercase tracking-[0.2em]">
              Why Choose Us
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-6">
              Everything You Need to{" "}
              <span className="text-gradient">Succeed</span>
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto text-lg">
              We have invested in the best because you deserve the best. Every
              detail is designed for your success.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                data-aos="fade-up"
                data-aos-delay={i * 100}
                className="group p-6 sm:p-8 rounded-2xl bg-linear-to-r from-soft-dark/20 to-classic-gold/20 border border-dark-bronze hover:border-amber-500/30 transition-all duration-500 hover:bg-dark-bronze/10"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-6 h-6 text-classic-gold" />
                </div>
                <h3 className="text-xl font-bold text-zinc-100 mb-3">
                  {feature.title}
                </h3>
                <p className="text-zinc-400 leading-relaxed text-sm">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>


      <section className="py-16 sm:py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-900/20 via-zinc-900 to-amber-900/20" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />

        <div
          data-aos="zoom-in"
          className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
            <span className="text-sm text-classic-gold font-medium">
              Life Changing Habits
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Ready to Transform
            <span className="text-gradient">Your Life?</span>
          </h2>
          <p className="text-zinc-400 text-lg mb-10 max-w-2xl mx-auto">
            The journey of a thousand miles begins with a single step. Your
            future self is waiting stronger, healthier, and unstoppable. Don't
            wait for the perfect moment. Take the leap today.
          </p>
          <Link to="./register">
            <button className="group px-10 py-4 bg-gradient text-zinc-950 font-bold text-lg rounded-xl hover:shadow-xl hover:shadow-amber-500/30 transition-all duration-300 hover:scale-105 flex items-center gap-2 mx-auto">
              Register Now!
            </button>
          </Link>
        </div>
      </section>


      <section id="faq" className="py-20 sm:py-28 relative bg-zinc-900/20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div data-aos="fade-up" className="text-center mb-16">
            <span className="text-gradient text-sm font-bold uppercase tracking-[0.2em]">
              Got Questions?
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mt-4 mb-6">
              Frequently Asked <span className="text-gradient">Questions</span>
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                data-aos="fade-up"
                data-aos-delay={i * 100}
                className="rounded-xl bg-gradient-to-r from-dark-bronze/20 via-pure-black to-dark-bronze/20 border border-zinc-800 overflow-hidden"
              >
                <button
                  onClick={() => setActiveFAQ(activeFAQ === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 sm:p-6 text-left hover:bg-zinc-800/40 transition-colors"
                >
                  <span className="font-semibold text-zinc-200 text-sm sm:text-base pr-4">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-classic-gold shrink-0 transition-transform duration-300 ${activeFAQ === i ? "rotate-180" : ""
                      }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${activeFAQ === i ? "max-h-40" : "max-h-0"
                    }`}
                >
                  <p className="px-5 sm:px-6 pb-5 sm:pb-6 text-zinc-400 text-sm leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      <footer className="border-t border-zinc-800 bg-zinc-950 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg bg-transparent flex items-center justify-center">
                  <img src={logo} alt="Web Logo" />
                </div>
                <span className="text-lg font-bold">
                  <span className="text-light-gold">CAPRA</span>
                  <span className="text-gradient">FITNESS</span>
                </span>
              </div>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Premium fitness experience designed for those who refuse to
                settle for average.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-4">
                Quick Links
              </h4>
              <ul className="space-y-3">
                {["Features", "Plans", "Testimonials", "FAQ"].map((link) => (
                  <li key={link}>
                    <button
                      onClick={() => scrollToSection(link.toLowerCase())}
                      className="text-zinc-500 hover:text-classic-gold text-sm transition-colors"
                    >
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-4">
                Contact
              </h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-2 text-zinc-500 text-sm">
                  <MapPin className="w-4 h-4 text-classic-gold" />
                  Andal Alino, Talavera, Nueva Ecija, Philippines 
                </li>
                <li className="flex items-center gap-2 text-zinc-500 text-sm">
                  <Phone className="w-4 h-4 text-classic-gold" />
                  (555) 123-4567
                </li>
                <li className="flex items-center gap-2 text-zinc-500 text-sm">
                  <Mail className="w-4 h-4 text-classic-gold" />
                  hello@caprafitness.com
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-4">
                Hours
              </h4>
              <ul className="space-y-2 text-zinc-500 text-sm">
                <li className="flex justify-between">
                  <span>Mon - Sun</span>
                  <span className="text-zinc-300">6AM - 12AM</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-zinc-600 text-sm">
              © 2026 Capra Fitness. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              {[
                {
                  name: "Instagram",
                  svg: (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                    </svg>
                  ),
                },
                {
                  name: "Facebook",
                  svg: (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                    </svg>
                  ),
                },
                {
                  name: "Twitter",
                  svg: (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
                    </svg>
                  ),
                },
              ].map((social, i) => (
                <button
                  key={i}
                  className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-classic-gold hover:border-classic-gold transition-all"
                >
                  {social.svg}
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
