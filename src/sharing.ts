import {SharingClient, Png, Context, SharableApp, Representation, escapeFirebaseKey} from 'cc-sharing';
import { log } from "./utils";
import { paramsFromContext, paramsWithoutSharing } from "./params";
import { v1 as uuid  } from "uuid"
import * as queryString from "query-string"

interface Firebse {
  storage:any;
  database:any;
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

//log("loading `sharing.ts`");

export default class Sharing {
  context: Context;
  storageRefPath: string;
  isClone: boolean
  getAppF:()=>appDescriptor[]
  cloneData: (cloneRef:any, callback?:Function) => void

  constructor(getAppF:()=>appDescriptor[], isClone:boolean, cloneData: (cloneRef:any, callback?:Function) => void) {
    this.getAppF = getAppF;
    this.isClone = isClone;
    this.cloneData = cloneData;
    this.share();
  }

  setContext(_context:Context|null) {
    if (this.isClone) {
      return
    }
    if(_context !== null) {
      this.context = _context;
      paramsFromContext(_context, "setContext");
      //log(_context);
      this.storageRefPath = `thumbnails/${escapeFirebaseKey(this.context.offering)}/${escapeFirebaseKey(this.context.group)}/${escapeFirebaseKey(this.context.class)}/${escapeFirebaseKey(this.context.id)}`;
    }
    else {
      //log("No context passed in 💀");
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
    //log(`✔ initiating sharing for ${name}`);
    let publishing = false
    const app:SharableApp = {
      application: () => {
        let launchUrl = window.location.href
        if (publishing) {
          // save a copy of the current firebase data into a cloned session
          const publicationId = uuid()
          const publishRef = firebase.database().ref(`publications/${publicationId}`)
          this.cloneData(publishRef)

          // remove all the sharing params and add the publication id
          const params = paramsWithoutSharing()
          params.sharing_publication = publicationId
          const a = document.createElement("a")
          a.href = launchUrl
          a.hash = queryString.stringify(params)
          launchUrl = a.toString()

          publishing = false
        }
        return {
          launchUrl: launchUrl,
          name: "MugWumps"
        }
      },
      getDataFunc: (_context:Context|null) => {
        publishing = true
        this.setContext(_context);
        const appPromises  = this.getAppF().map((geog) => this.snapshotPromise(geog.app, geog.name));
        return Promise.all(appPromises);
      },
      initCallback: (_context:Context) => {
        this.setContext(_context);
      }
    }
    if (!this.isClone) {
      const sharePhone = new SharingClient({app});
    }
    //log(`✔ sharing enabled for ${name}`);
  }
}
