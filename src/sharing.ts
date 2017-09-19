import {SharingClient, Png, Context, SharableApp} from 'cc-sharing';
import { log } from "./utils";

interface Firebse {
  storage:any;
};
interface FBStorageRef {
  downloadURL: string;
};

declare var firebase:Firebse;

log("loading `sharing.ts`");

export default class Sharing {
  context: Context;
  filename: string;
  name:string;
  getGeogAppletF: Function;

  constructor(_getAppF: Function, _name:string) {
    this.getGeogAppletF = _getAppF;
    this.name = _name;
  }

  setContext(_context:Context|null) {
    if(_context !== null) {
      this.context = _context;
      this.filename = `thumbnails/${this.context.offering.id}/${this.context.group.id}/${this.context.clazz.id}/${this.context.localId}.png`;
      log(this.context);
    }
    else {
      log("No context passed in 💀");
    }
  }

  share() {
    log(`✔ initiating sharing for ${name}`);
    const app:SharableApp = {
      application: {
        launchUrl: window.location.href,
        name: this.name
      },
      getDataFunc: (_context:Context|null) => {
        const _applet = this.getGeogAppletF();
        this.setContext(_context);
        return new Promise( (resolve, reject) => {
          const handleBase64PNG = function(base64PNG:string) {
            var storageRef = firebase.storage().ref();
            var fileRef = storageRef.child(this.filename);
            if(base64PNG) {
              fileRef.putString(base64PNG, 'base64', {contentType:'image/jpg'}).then((results:FBStorageRef) => {
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
}
