import { Injectable } from '@angular/core';

import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

import { Platform } from '@ionic/angular';  // obtener datos plataforma
import { Capacitor } from '@capacitor/core';  // convertir URI con Capacitor 

@Injectable({
  providedIn: 'root'
})
export class PhotoService {

  public photos: UserPhoto[] = [];  // array de fotos
  private PHOTO_STORAGE: string = 'photos';  // clave cajon de fotos
  private platform: Platform;

  constructor(platform: Platform) {
    this.platform = platform;
  }

  // Tomar una foto
  public async addNewToGallery() {

    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100
    });

    // guardar y agregar foto al inico del array
    const savedImageFile = await this.savePicture(capturedPhoto);
    this.photos.unshift(savedImageFile);

    // guardar matriz Fotos, no importa si user cierra app
    Preferences.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos),
    });

  }

  // Funcionalidad Guardar Foto
  private async savePicture(photo: Photo) {
    // Convert photo to base64 format, required by Filesystem API to save
    const base64Data = await this.readAsBase64(photo);

    // ! Escribir archivo en el directorio de datos (sistema de archivos.)  !
    const fileName = new Date().getTime() + '.jpeg';
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data
    });

    if ( this.platform.is('hybrid') ) {
      // Display the new image by rewriting the 'file://' path to HTTP
      // Details: https://ionicframework.com/docs/building/webview#file-protocol
      return {
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri),
      };
    }
    else {  // En WEB
      // Use webPath to display the new image instead of base64 since it's
      // already loaded into memory
      return {
        filepath: fileName,
        webviewPath: photo.webPath
      };
    }

  }

  private async readAsBase64(photo: Photo) {

    // "hybrid" will detect Cordova or Capacitor
    if ( this.platform.is('hybrid') ) {
      // Read the file into base64 format
      const file = await Filesystem.readFile({
        path: photo.path!,  //  agregar ! indica que photo.path no es nulo
      });

      return file.data;
    }
    else {
      // En WEB Obtenga la foto, léala como un blob, luego conviértala al formato base64
      const response = await fetch(photo.webPath!);
      const blob = await response.blob();

      return await this.convertBlobToBase64(blob) as string;
    }

  }

  private convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });

  // Recuperar fotos guardadas
  public async loadSaved() {
    //  Recuperar array de fotos cacheado
    const { value } = await Preferences.get({ key: this.PHOTO_STORAGE });
    this.photos = (value ? JSON.parse(value) : []) as UserPhoto[];

    // Easiest way to detect when running on the web:
    // “when the platform is NOT hybrid, do this”
    if (!this.platform.is('hybrid')) {
      // Reestablecer array de Fotos en formato base64 (solo para web)
      for (let photo of this.photos) {
        // Lea datos de cada foto guardada en sistema de archivos
        const readFile = await Filesystem.readFile({
          path: photo.filepath,
          directory: Directory.Data,
        });

        // Solo plataforma web: Cargue la foto como datos base64
        photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
      }

    }

  }

  // Borrar foto
  public async deletePicture(photo: UserPhoto, position: number) {
    // Remove this photo from the Photos reference data array
    this.photos.splice(position, 1);
  
    // Update photos array cache by overwriting the existing photo array
    Preferences.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos)
    });
  
    // delete photo file from filesystem
    const filename = photo.filepath
                        .substr(photo.filepath.lastIndexOf('/') + 1);
  
    await Filesystem.deleteFile({
      path: filename,
      directory: Directory.Data
    });
  }

}

export interface UserPhoto {
  filepath: string;
  webviewPath?: string;
}