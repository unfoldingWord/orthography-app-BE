## Introduction
This code forms part of the backend for the 'orthography-app' application. 
Data is to be stored in a **MongoDB** instance, and storage of media files will occur in an **AWS S3 bucket**. 

**Notice**: this is a PoC, and thus everything is subject to change! Also, functionality is limited!

## How to setup the ortography-app backend
Prerequisites:
- You need to have an S3 bucket available. Keep note the name of this bucket.
- You need a user with access to this S3 bucket. This user needs to have API keys. Keep note of the Access Key and the Secret Access Key.

### Installation
#### Using Docker
Using Docker compose is the easiest method. The provided `compose` template already starts a MongoDB server together with the OrthoApp backend application.

Make a copy of the provided `compose-template.yaml` file
```
cp compose-template.yaml compose.yaml
```

Within the file `compose.yaml`, change all the strings that are `<bracketed>` into actual values.

Start the container stack
```
docker compose up -d
```

#### Running manually

Clone this repository
```
git clone https://github.com/unfoldingWord/orthography-app.git
```

Inside the repo, install the dependencies
```
cd ortography-app
npm install
```

Run the application
```
npm start
```

### Configuration
1) Add a baselanguage to the system. Currently, only English is supported.
```bash
curl -d '{"name":"English", "code":"en"}' -H 'Content-Type: application/json' http://localhost:5000/api/language/add
```
Take note of the generated `_id`, that looks like `663b4d663937e0dd156aaef4`

2) Outside of your backend directory, clone the image upload app (which is currently on a feature branch)
```
mkdir ortho-upload && cd ortho-upload
git clone -b upload-script git@github.com:unfoldingWord/orthography-app.git
```

3) Open the script `uploadImagesScript` and modify 
- the `apiUrl`. Probably, you only need to change the port into `5000`. 
- the `languageId`. This should be the value that you took from step 1)

4) Create a directory `images` and fill it with the images that need to be uploaded
```
mkdir images
cp /path/to/original-images/* images/
```

5) Install `nodejs`, if that is not installed yet
```
apt install nodejs
```

6) Run the import script
```
node uploadImagesScript.js
```