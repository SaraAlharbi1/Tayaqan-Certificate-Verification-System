import FooterWave from "@/assets/footer-wave.png";
import { Twitter, Instagram } from "lucide-react";

/**
 * Footer component
 *
 * Contains:
 *   - Decorative curve image at the Bottom
 *   - Three columns: Follow Us, Services, Contact Details
 *   - Copyright notice
 */
export default function Footer() {
  return (
    <footer className="relative text-white mt-20">
      {/* Decorative curve image */}
      <img
        src={FooterWave}
        alt=""
        className="absolute top-0 left-0 w-full h-auto pointer-events-none select-none"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-20 pb-8">
        <div className="grid md:grid-cols-3 gap-10 text-sm leading-relaxed">
          {/* Column: Social links */}
          <div>
            <h4 className="font-semibold text-lg mb-3 text-white">Follow Us</h4>
            <ul className="space-y-2 text-gray-200">
              <li className="flex items-center gap-2">
                <Twitter className="w-4 h-4" /> Twitter
              </li>
              <li className="flex items-center gap-2">
                <Instagram className="w-4 h-4" /> Instagram
              </li>
            </ul>
          </div>

          {/* Column: Services */}
          <div>
            <h4 className="font-semibold text-lg mb-3 text-white">Our Services</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-200">
              <li>Certificate Issuance</li>
              <li>Secure Sharing</li>
              <li>Instant Verification</li>
            </ul>
          </div>

          {/* Column: Contact details */}
          <div>
            <h4 className="font-semibold text-lg mb-3 text-white">Contact Details</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-200">
              <li>Email: contact@tayaqan.com</li>
              <li>Location: Jeddah, Saudi Arabia</li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="text-center text-xs mt-10 text-gray-200">
          © {new Date().getFullYear()} Tayaqan. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
