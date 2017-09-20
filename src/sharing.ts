import {SharingClient, Png, Context, SharableApp, Representation} from 'cc-sharing';
import { log } from "./utils";
import { paramsFromContext } from "./params";

interface Firebse {
  storage:any;
};
interface FBStorageRef {
  downloadURL: string;
};

interface appDescriptor {
  app:GeogApp;
  name:string;
}

interface GeogApp {
  getScreenshotBase64(callback:Function): string;
}

declare var firebase:Firebse;

log("loading `sharing.ts`");

export default class Sharing {
  context: Context;
  storageRefPath: string;
  getAppF:()=>appDescriptor[]

  constructor(getAppF:()=>appDescriptor[]) {
    this.getAppF = getAppF;
    this.share();
  }

  setContext(_context:Context|null) {
    if(_context !== null) {
      this.context = _context;
      paramsFromContext(_context);
      log(_context);
      this.storageRefPath = `thumbnails/${this.context.offering.id}/${this.context.group.id}/${this.context.clazz.id}/${this.context.localId}`;
    }
    else {
      log("No context passed in 💀");
    }
  }

  snapshotPromise(applet:GeogApp, name:string){
    const filename = `${this.storageRefPath}/${name}.jpg`;
    return new Promise<Representation>( (resolve, reject) => {
      const handleBase64PNG = function(base64PNG:string) {
        var storageRef = firebase.storage().ref();
        var fileRef = storageRef.child(filename);
        if(base64PNG) {
          fileRef.putString(base64PNG, 'base64', {contentType:'image/jpg'}).then((results:FBStorageRef) => {
              resolve(
                {type: Png, dataUrl: results.downloadURL, name:'stretch and shrink'}
              )
            }
          );
        }
        else {
          reject("Couldn't create firebase file from canvas base64PNG");
        }
      };
      applet.getScreenshotBase64(handleBase64PNG);
    });
  }

  share() {
    log(`✔ initiating sharing for ${name}`);
    const app:SharableApp = {
      application: {
        launchUrl: window.location.href,
        name: "MugWumps"
      },
      getDataFunc: (_context:Context|null) => {
        this.setContext(_context);
        const appPromises  = this.getAppF().map((geog) => this.snapshotPromise(geog.app, geog.name));
        return Promise.all(appPromises);
      },
      initCallback: (_context:Context) => {
        this.setContext(_context);
      }
    }
    const sharePhone = new SharingClient({app});
    log(`✔ sharing enabled for ${name}`);
  }
}
