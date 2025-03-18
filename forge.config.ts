import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';
import fs from "fs";
import path from "path";
import { globSync } from "glob";
import { spawnSync } from "child_process";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './src/Viridos-Logo_512' // no file extension required
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
        name: "SNAPProbeCalibrate",
        setupIcon: './src/Viridos-Logo_512.ico'
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({})],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  // hooks was copied from https://github.com/Dygmalab/Bazecor/blob/development/forge.config.ts
  // to get electron to build with 'serialport' correctly. See also https://github.com/electron/forge/issues/3282
  hooks: {
    packageAfterPrune: async (_forgeConfig, buildPath, _electronVersion, platform, _arch) => {
      /**
       * Serialport, usb and uiohook-napi are problematic libraries to run in Electron.
       * When Electron app is been built, these libraries are not included properly in the final executable.
       * What we do here is to install them explicitly and then remove the files that are not for the platform
       * we are building for
       */
      const packageJson = JSON.parse(fs.readFileSync(path.resolve(buildPath, "package.json")).toString());

      packageJson.dependencies = {
        serialport: "^13.0.0"
      };

      fs.writeFileSync(path.resolve(buildPath, "package.json"), JSON.stringify(packageJson));
      spawnSync("npm", ["install", "--omit=dev"], {
        cwd: buildPath,
        stdio: "inherit",
        shell: true,
      });

      const prebuilds = globSync(`${buildPath}/**/prebuilds/*`);
      prebuilds.forEach(function (path) {
        if (!path.includes(platform)) {
          fs.rmSync(path, { recursive: true });
        }
      });
    },
  }
};

export default config;
