import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ferme Agro-piscicole Saint André",
    short_name: "FSA",
    description:
      "Spécialistes en Pisciculture, Agriculture et Élevage au Bénin. Formations certifiantes et stages pratiques.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#e60023",
    icons: [
      {
        src: "/logo-fsa.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
