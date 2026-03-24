import GeomClip from "./Incidents/GeomClip";
import Highlight from "./Incidents/Highlight";
import { name, version } from "../package.json";

export default {
  npm_name: name, // don't touch this
  version: version, // don't touch this
  incidents: [
    {
      exportable: Highlight,
      name: "Highlight",
    },
  ],
  Clip: {
    exportable: GeomClip,
  },
};
