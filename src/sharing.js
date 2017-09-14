import {SharingClient, SharingLib, Png} from 'cc-sharing';
import { log } from "./utils";
log("loading `sharing.js`");

export function share(getApplet, name) {
  log(`✔ initiating sharing for ${name}`);
  const app = {
    application: {
      launchUrl: window.location.href,
      name: "Graph Sheet (stretch and shrink)"
    },
    getDataFunc: (context) => {
      const _applet = getApplet();
      let filename = "thumbnails/untitled.png";
      if(context) {
        filename = `thumbnails/${context.offering.id}/${context.group.id}/${context.clazz.id}/${context.localId}.png`;
        log(context);
      }
      else {
        log("No context passed in 💀");
      }
      return new Promise( (resolve, reject) => {
        const handleBase64PNG = function(base64PNG) {
          var storageRef = firebase.storage().ref();
          var fileRef = storageRef.child(filename);
          if(base64PNG) {
            fileRef.putString(base64PNG, 'base64', {contentType:'image/jpg'}).then((results) => {
                resolve(
                  [{type: Png, dataUrl: results.downloadURL, name:'stretch and shrink'}]
                )
              }
            );
          }
          else {
            reject("Couldn't create firebase file from canvas base64PNG");
          }
        };
        _applet.getScreenshotBase64(handleBase64PNG);
      });
    }
  }
  const sharePhone = new SharingClient({app});
  log(`✔ sharing enabled for ${name}`);
}
log("✔ done loading sharing.js");
