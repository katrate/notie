import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { PageTypes } from "./components/PageTypes";
import { Downloads } from "./components/Downloads";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <div className="app">
      <Hero />
      <Features />
      <PageTypes />
      <Downloads />
      <Footer />
    </div>
  );
}
