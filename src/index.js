import GeomClip from "./Incidents/GeomClip";
import Attr from "./Incidents/Attr";
import Highlight from "./Incidents/Highlight";
import Morph from "./Incidents/Morph";
import Rotate from "./Incidents/Rotate";
import Translate from "./Incidents/Translate";
import { name, version } from "../package.json";

export default {
  npm_name: name, // don't touch this
  version: version, // don't touch this
  incidents: [
    {
      exportable: Attr,
      name: "Attr",
    },
    {
      exportable: Highlight,
      name: "Highlight",
    },
    {
      exportable: Rotate,
      name: "Rotate",
    },
    {
      exportable: Translate,
      name: "Translate",
    },
    {
      exportable: Morph,
      name: "Morph",
    },
  ],
  Clip: {
    exportable: GeomClip,
  },
};
