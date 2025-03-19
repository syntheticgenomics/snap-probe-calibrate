# snap-probe-calibrate
A stand-alone app for calibrating the L-com SRWQ100-pH104 sensor

This was created using node 22.

### Run the app in dev mode
This will compile changes on-the-fly.
```sh
> npm start
```

### Create a executable app
This will create an executable binary in the `out/SNAP Probe Calibrate-<platform>` directory
```sh
> npm run package
```

### Create an installer
1. This will create an installer under the `out/make` directory
    ```sh
    > npm run make
    ```

2. Upload the installer to the S3 bucket `snap-probe-calibrate` so users can download it from the following web page:  
http://snap-probe-calibrate.s3-website-us-west-2.amazonaws.com/

