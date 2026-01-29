import { db } from "@/db";
import { schoolSettings } from "@/db/schema/misc";
import { ContactForm } from "@/components/contact/contact-form";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Facebook,
  Instagram,
  Youtube,
  MessageSquare,
} from "lucide-react";
import { MoveUpRight } from "lucide-react";

async function getContactData() {
  const [settings] = await db.select().from(schoolSettings).limit(1);
  return settings;
}

const socialLinks = [
  { icon: Facebook, href: "#", label: "Facebook" },
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Youtube, href: "#", label: "Youtube" },
];

export default async function KontakPage() {
  const settings = await getContactData();

  // Default values if no settings found
  const schoolName = settings?.schoolName || "SD Negeri 1 Kenanga";
  const schoolAddress = settings?.schoolAddress || "Jl. Pendidikan No. 123, Kel. Sukamaju, Kec. Kota Utara, Jakarta 12345";
  // Default coordinates (Jakarta) if none set
  const schoolLat = settings?.schoolLat || -6.2088;
  const schoolLng = settings?.schoolLng || 106.8456;
  const maxDistance = settings?.maxDistanceKm || 1;

  const contactInfo = [
    {
      icon: MapPin,
      title: "Alamat",
      content: schoolAddress,
    },
    {
      icon: Phone,
      title: "Telepon",
      content: "(021) 1234-5678",
    },
    {
      icon: Mail,
      title: "Email",
      content: "info@sdnegeri1.sch.id",
    },
    {
      icon: Clock,
      title: "Jam Operasional",
      content: "Senin - Jumat: 07:00 - 15:00 WIB",
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section */}
      <section className="relative pt-8 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-primary/5" />
        <div className="absolute top-20 left-1/3 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]" />

        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Badge variant="outline" className="px-4 py-1.5 rounded-full">
              <MessageSquare className="h-3 w-3 mr-1" />
              Hubungi Kami
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Kontak Kami
            </h1>
            <p className="text-lg text-muted-foreground">
              Ada pertanyaan atau saran? Kami senang mendengar dari Anda.
              Hubungi kami melalui form atau informasi kontak di bawah ini.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16">
        <div className="container">
          <div className="grid lg:grid-cols-5 gap-12">
            {/* Contact Info */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-4">Informasi Kontak</h2>
                <p className="text-muted-foreground">
                  Silakan hubungi kami melalui salah satu cara berikut:
                </p>
              </div>

              <div className="space-y-6">
                {contactInfo.map((item, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-muted-foreground text-sm">{item.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <h3 className="font-semibold mb-4">Ikuti Kami</h3>
                <div className="flex gap-3">
                  {socialLinks.map((social, index) => (
                    <a
                      key={index}
                      href={social.href}
                      className="h-11 w-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-primary hover:text-white transition-all"
                      aria-label={social.label}
                    >
                      <social.icon className="h-5 w-5" />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-3">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="py-16 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
             <div>
                <h2 className="text-2xl font-bold">Lokasi Kami</h2>
                <p className="text-muted-foreground mt-1">Kunjungi sekolah kami di lokasi berikut.</p>
             </div>
             <a 
                href={`https://www.google.com/maps/search/?api=1&query=${schoolLat},${schoolLng}`}
                target="_blank"
                rel="noreferrer" 
                className="hidden sm:flex items-center gap-2 text-sm font-medium text-primary hover:underline"
             >
                Buka di Google Maps <MoveUpRight className="h-4 w-4" />
             </a>
          </div>
          
          <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-xl border border-zinc-200 dark:border-zinc-800 relative bg-muted">
             <iframe 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                scrolling="no" 
                marginHeight={0} 
                marginWidth={0} 
                src={`https://maps.google.com/maps?q=${schoolLat},${schoolLng}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                className="w-full h-full border-0 filter grayscale-[0.2] hover:grayscale-0 transition-all duration-500"
                allowFullScreen
             />
          </div>
        </div>
      </section>
    </div>
  );
}
