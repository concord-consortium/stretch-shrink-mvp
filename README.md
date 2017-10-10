# Stretch & Shrink MVP  (AKA MugWumps) #

An MVP experiment in collaborative GeoGebra workspaces for the MSU "Digital Inscriptions" project.


## Building ##
- `yarn` : installs dependencies.
- `webpack` : creates `dist/index.html`
- `webpack-dev-server`: live reloading development server to hack on.

### Travis Deployment ###
Travis will automatically build approved commits. Resulting builds will be available at `mugwumps.concord.org/branch/<branch-name>/index.html, for example, the master demo is at http://mugwumps.concord.org/branch/master/index.html

### Sharinating ###
This project uses the [cc-sharing library](github.com/concord-consortium/cc-sharing-lib)

### Url Parameters ###
TODO: We are moving from query parameters to hash parameters. (TBD)

- `sheetId` _string_ the GeoGebra material ID for the initial MugWump Sheet
- `gridId`  _string_ the GeoGebra material ID for the initial Graph
- `sharing_offfering` _string_ the offering for sharinator. This value will be **automatically set in some cases**.
- `sharing_class` _string_ the class for sharinator. This value will be **automatically set in some cases**.
- `sharing_grpup` _string_ the group for sharinator. This value will be **automatically set in some cases**.

### References to GeoGebra embedding / scripting: ###
- https://www.geogebra.org/manual/en/Reference:Math_Apps_Embedding -- how to embed and customize the Apps
- https://www.geogebra.org/manual/en/Reference:JavaScript -- JavaScript API to interact with the Apps
- https://www.github.com/geogebra/math-apps-examples -- examples of Math Apps embedded in HTML you can clone and play with

### License ###
You are free to copy, distribute and transmit this project for non-commercial purposes. For details see [the GeoGebra License](https://www.geogebra.org/license)