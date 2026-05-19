/**
 * Optical Capsule — demo page: rigs, control panels, schedule + boot.
 */
import { createOpticalCapsuleCore, DEFAULT_LABEL_TEXT, rgbToHex, hexToRgb } from "./OpticalCapsule.js";

const debugBake =
  typeof location !== "undefined" && new URLSearchParams(location.search).has("debug");

const sceneLighting = {
        enabled: true,
        timeDrift: false,
        ambient: {
          color: [0.04, 0.045, 0.06],
          intensity: 0.34
        },
        lights: [
          {
            id: "key",
            type: "point",
            position: [0.72, -0.28, 1.18],
            color: [1.0, 0.98, 0.94],
            intensity: 1.08,
            specular: 1.0,
            range: 0.42,
            distance: 1.0,
            azimuth: -45,
            elevation: 45
          },
          {
            id: "cyan-rim",
            type: "area",
            position: [-0.22, 0.78, 0.48],
            color: [0.12, 0.78, 1.0],
            intensity: 0.62,
            specular: 0.78,
            range: 0.78,
            distance: 1.25,
            azimuth: -45,
            elevation: 45
          },
          {
            id: "violet-fill",
            type: "area",
            position: [1.08, 0.58, 0.52],
            color: [0.62, 0.34, 1.0],
            intensity: 0.38,
            specular: 0.48,
            range: 0.92,
            distance: 1.45,
            azimuth: -45,
            elevation: 45
          }
        ]
      };

      const sceneMaterial = {
        color: [0.92, 0.9, 0.86],
        ior: 1.52,
        roughness: 0.028,
        reflectivity: 1.0,
        transmission: 0.68,
        thickness: 0.88,
        absorption: 0.1,
        dispersion: 0.08,
        internalReflection: 0.88,
        surfaceLift: 0.18,
        clearcoat: 0.99,
        clearcoatRoughness: 0.018,
        backdropDisplaceTry: false
      };

      const materialPresets = {
        resin: {
          color: [0.92, 0.9, 0.86],
          ior: 1.52,
          roughness: 0.028,
          reflectivity: 1.0,
          transmission: 0.68,
          thickness: 0.88,
          absorption: 0.1,
          dispersion: 0.08,
          internalReflection: 0.88,
          surfaceLift: 0.18,
          clearcoat: 0.99,
          clearcoatRoughness: 0.018
        },
        glass: {
          color: [0.08, 0.11, 0.15],
          ior: 1.52,
          roughness: 0.06,
          reflectivity: 1.0,
          transmission: 0.38,
          thickness: 0.88,
          absorption: 0.42,
          dispersion: 0.04,
          internalReflection: 0.68,
          surfaceLift: 0.4,
          clearcoat: 0.96,
          clearcoatRoughness: 0.038
        },
        crystal: {
          color: [0.9, 0.93, 0.98],
          ior: 1.54,
          roughness: 0.04,
          reflectivity: 1.0,
          transmission: 0.58,
          thickness: 0.98,
          absorption: 0.16,
          dispersion: 0.09,
          internalReflection: 0.88,
          surfaceLift: 0.36,
          clearcoat: 0.98,
          clearcoatRoughness: 0.028
        },
        diamond: {
          color: [0.97, 0.99, 1.0],
          ior: 2.42,
          roughness: 0.02,
          reflectivity: 1.0,
          transmission: 0.64,
          thickness: 1.12,
          absorption: 0.06,
          dispersion: 0.14,
          internalReflection: 1.22,
          surfaceLift: 0.34,
          clearcoat: 1.0,
          clearcoatRoughness: 0.018
        },
        ruby: {
          color: [0.74, 0.07, 0.13],
          ior: 1.77,
          roughness: 0.05,
          reflectivity: 1.0,
          transmission: 0.34,
          thickness: 0.92,
          absorption: 0.98,
          dispersion: 0.05,
          internalReflection: 0.74,
          surfaceLift: 0.4,
          clearcoat: 0.9,
          clearcoatRoughness: 0.042
        },
        sapphire: {
          color: [0.1, 0.2, 0.72],
          ior: 1.77,
          roughness: 0.05,
          reflectivity: 1.0,
          transmission: 0.36,
          thickness: 0.9,
          absorption: 0.94,
          dispersion: 0.055,
          internalReflection: 0.76,
          surfaceLift: 0.4,
          clearcoat: 0.92,
          clearcoatRoughness: 0.04
        }
      };

      let activeMaterialPreset = "resin";

      function applyMaterialPresetValues(values) {
        sceneMaterial.color = values.color.slice();
        sceneMaterial.ior = values.ior;
        sceneMaterial.roughness = values.roughness;
        sceneMaterial.reflectivity = values.reflectivity;
        sceneMaterial.transmission = values.transmission;
        sceneMaterial.thickness = values.thickness;
        sceneMaterial.absorption = values.absorption;
        sceneMaterial.dispersion = values.dispersion;
        sceneMaterial.internalReflection = values.internalReflection;
        sceneMaterial.surfaceLift = values.surfaceLift;
        sceneMaterial.clearcoat = values.clearcoat;
        sceneMaterial.clearcoatRoughness = values.clearcoatRoughness;
      }

      const sceneButtonSpec = {
        widthScale: 1,
        heightScale: 1,
        topHeight: 22,
        edgeHeight: 8,
        zRadius: 56,
        shoulderWidth: 0.2,
        bevelWidth: 0.14
      };

      const sceneShell = {
        outerColor: [236 / 255, 248 / 255, 255 / 255],
        outerTransparency: 0,
        outerWidthScale: 1,
        outerFillOpacity: 0.06,
        innerColor: [1, 1, 1],
        innerTransparency: 0,
        innerWidthScale: 1,
        insetRingColor: [1, 1, 1],
        insetRingTransparency: 0,
        insetRingWidth: 4
      };

      const sceneLabel = {
        text: DEFAULT_LABEL_TEXT,
        color: [1, 1, 1],
        transparency: 1,
        shadowDarkColor: [0, 0, 0],
        shadowDarkOpacity: 0.78,
        shadowDarkOffsetY: 1,
        shadowDarkBlur: 1,
        shadowLightColor: [1, 1, 1],
        shadowLightOpacity: 0.28,
        shadowLightBlur: 1
      };

      const sceneBackground = {
        mode: "solid",
        base: [192 / 255, 32 / 255, 16 / 255],
        accent: [0.075, 0.13, 0.24],
        imageUrl: "",
        opacity: 0.32,
        scale: 28
      };

      function getRigs() {
        return {
          material: sceneMaterial,
          lighting: sceneLighting,
          buttonSpec: sceneButtonSpec,
          shell: sceneShell,
          background: sceneBackground,
          label: sceneLabel
        };
      }

      const core = createOpticalCapsuleCore(getRigs, { window });

const lightControlIds = {
        select: "light-select",
        color: "light-color",
        intensity: "light-intensity",
        range: "light-range",
        distance: "light-distance",
        azimuth: "light-azimuth",
        elevation: "light-elevation"
      };

      const materialControlIds = {
        preset: "material-preset",
        color: "material-color",
        ior: "material-ior",
        transmission: "material-transmission",
        absorption: "material-absorption",
        thickness: "material-thickness",
        dispersion: "material-dispersion",
        internalReflection: "material-internal",
        surfaceLift: "material-lift",
        backdropDisplace: "material-backdrop-displace"
      };

      const buttonSpecControlIds = {
        widthScale: "button-width-scale",
        heightScale: "button-height-scale",
        topHeight: "button-top-height",
        edgeHeight: "button-edge-height",
        zRadius: "button-z-radius",
        shoulderWidth: "button-shoulder",
        bevelWidth: "button-bevel"
      };

      const shellControlIds = {
        outerColor: "shell-outer-color",
        outerTransparency: "shell-outer-transparency",
        outerWidthScale: "shell-outer-width",
        outerFillOpacity: "shell-outer-fill",
        innerColor: "shell-inner-color",
        innerTransparency: "shell-inner-transparency",
        innerWidthScale: "shell-inner-width",
        insetRingColor: "shell-inset-color",
        insetRingTransparency: "shell-inset-transparency",
        insetRingWidth: "shell-inset-width"
      };

      const labelControlIds = {
        text: "label-text",
        color: "label-color",
        transparency: "label-transparency",
        shadowDarkColor: "label-shadow-dark-color",
        shadowDarkOpacity: "label-shadow-dark-opacity",
        shadowDarkOffsetY: "label-shadow-dark-offset",
        shadowDarkBlur: "label-shadow-dark-blur",
        shadowLightColor: "label-shadow-light-color",
        shadowLightOpacity: "label-shadow-light-opacity",
        shadowLightBlur: "label-shadow-light-blur"
      };

      const labelControlIdSet = new Set(Object.values(labelControlIds));

      const backgroundControlIds = {
        mode: "background-mode",
        base: "background-base",
        accent: "background-accent",
        image: "background-image",
        opacity: "background-opacity",
        scale: "background-scale"
      };

      const PRESENTATION_STATES = ["rest", "hover", "pressed", "inactive"];

      /** Glow / button tint RGBA helpers; optics not rebaked. */
      function presentationGlowRgba(hex, alpha) {
        const rgb = hexToRgb(hex);
        const a = Math.max(0, Math.min(1, Number(alpha)));
        return `rgba(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)},${a})`;
      }

      function presEl(state, suffix) {
        return document.getElementById(`pres-${state}-${suffix}`);
      }

      function syncPresentationLabelsForState(state) {
        [
          [`pres-${state}-opacity-value`, Number(presEl(state, "opacity")?.value ?? 1).toFixed(2)],
          [`pres-${state}-brightness-value`, Number(presEl(state, "brightness")?.value ?? 1).toFixed(2)],
          [`pres-${state}-saturate-value`, Number(presEl(state, "saturate")?.value ?? 1).toFixed(2)],
          [`pres-${state}-glow-blur-value`, `${Number(presEl(state, "glow-blur")?.value ?? 0).toFixed(1)}px`],
          [`pres-${state}-glow-alpha-value`, Number(presEl(state, "glow-alpha")?.value ?? 0).toFixed(2)],
          [`pres-${state}-button-tint-value`, Number(presEl(state, "button-tint")?.value ?? 0).toFixed(2)]
        ].forEach(([id, text]) => setControlText(id, text));
      }

      /** CSS-only on each column’s `.capsule-stage` — never calls `scheduleRenderAll`. */
      function applyPresentationForState(state) {
        const stage = document.querySelector(
          `.presentation-column[data-presentation-state="${state}"] .capsule-stage`
        );
        if (!stage) return;

        const opacity = presEl(state, "opacity")?.value ?? "1";
        const brightness = presEl(state, "brightness")?.value ?? "1";
        const saturate = presEl(state, "saturate")?.value ?? "1";
        const glowBlurPx = Number(presEl(state, "glow-blur")?.value ?? 0).toFixed(1);
        const glowAlpha = presEl(state, "glow-alpha")?.value ?? "0";
        const glowHex = presEl(state, "glow-color")?.value ?? "#aad4ff";
        const btnHex = presEl(state, "button-color")?.value ?? "#ffffff";
        const btnTint = presEl(state, "button-tint")?.value ?? "0";

        stage.style.setProperty("--presentation-opacity", opacity);
        stage.style.setProperty("--presentation-brightness", brightness);
        stage.style.setProperty("--presentation-saturate", saturate);
        stage.style.setProperty("--presentation-glow-blur", `${glowBlurPx}px`);
        stage.style.setProperty("--presentation-glow-color", presentationGlowRgba(glowHex, glowAlpha));
        stage.style.setProperty("--presentation-button-tint", presentationGlowRgba(btnHex, btnTint));

        syncPresentationLabelsForState(state);
      }

      function setupPresentationControls() {
        document.querySelectorAll(".presentation-panel .presentation-column").forEach(col => {
          const state = col.dataset.presentationState;
          if (!state) return;

          col.querySelectorAll('input[type="range"], input[type="color"]').forEach(el => {
            el.addEventListener("input", () => applyPresentationForState(state));
          });
        });

        PRESENTATION_STATES.forEach(applyPresentationForState);
      }

      function selectedLight() {
        const select = document.getElementById(lightControlIds.select);
        return getRigs().lighting.lights.find(light => light.id === select?.value) || getRigs().lighting.lights[0];
      }

      function setControlValue(id, value) {
        const input = document.getElementById(id);
        if (input) input.value = String(value);
      }

      function setControlText(id, value) {
        const node = document.getElementById(id);
        if (node) node.textContent = value;
      }

let renderTimer = null;

      function scheduleRenderAll(reason = "manual") {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(() => {
          const t0 = debugBake ? performance.now() : 0;
          core.applyButtonSpec();
          document.body.offsetHeight;
          const timeMs = performance.now();
          document.querySelectorAll(".capsule-stage").forEach(stage => {
            core.renderStage(stage, timeMs);
          });
          core.renderCrossSection(timeMs);
          if (debugBake) {
            console.info(`[optical-capsule] bake:${reason} ${(performance.now() - t0).toFixed(1)}ms`);
          }
        }, reason === "initial" ? 0 : 80);
      }

function syncBackgroundControlsFromState() {
        setControlValue(backgroundControlIds.mode, getRigs().background.mode);
        setControlValue(backgroundControlIds.base, rgbToHex(getRigs().background.base));
        setControlValue(backgroundControlIds.accent, rgbToHex(getRigs().background.accent));
        setControlValue(backgroundControlIds.image, getRigs().background.imageUrl);
        setControlValue(backgroundControlIds.opacity, getRigs().background.opacity.toFixed(2));
        setControlValue(backgroundControlIds.scale, Math.round(getRigs().background.scale));
        setControlText("background-opacity-value", getRigs().background.opacity.toFixed(2));
        setControlText("background-scale-value", `${Math.round(getRigs().background.scale)}px`);
      }

      function updateBackgroundFromControl(event) {
        const id = event.currentTarget.id;
        const value = event.currentTarget.value;

        if (id === backgroundControlIds.mode) getRigs().background.mode = value;
        if (id === backgroundControlIds.base) getRigs().background.base = hexToRgb(value);
        if (id === backgroundControlIds.accent) getRigs().background.accent = hexToRgb(value);
        if (id === backgroundControlIds.image) {
          getRigs().background.imageUrl = value.trim();
          if (getRigs().background.imageUrl) getRigs().background.mode = "image";
        }
        if (id === backgroundControlIds.opacity) getRigs().background.opacity = Number(value);
        if (id === backgroundControlIds.scale) getRigs().background.scale = Number(value);

        core.applyBackground();
        syncBackgroundControlsFromState();
        document.querySelectorAll(".optical-capsule").forEach(button => {
          core.applyShellStyles(button, button.offsetHeight);
        });
        scheduleRenderAll("background-control");
      }

      function setupBackgroundControls() {
        Object.values(backgroundControlIds).forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          if (el.tagName === "SELECT") {
            el.addEventListener("change", updateBackgroundFromControl);
          } else {
            el.addEventListener("input", updateBackgroundFromControl);
          }
        });

        core.applyBackground();
        syncBackgroundControlsFromState();
      }

      function syncLightControlsFromState() {
        const light = selectedLight();
        if (!light) return;

        setControlValue(lightControlIds.color, rgbToHex(light.color));
        setControlValue(lightControlIds.intensity, light.intensity.toFixed(2));
        setControlValue(lightControlIds.range, (light.range ?? 0.45).toFixed(2));
        setControlValue(lightControlIds.distance, (light.distance ?? 1).toFixed(2));
        setControlValue(lightControlIds.azimuth, Math.round(light.azimuth ?? -45));
        setControlValue(lightControlIds.elevation, Math.round(light.elevation ?? 45));

        setControlText("light-intensity-value", light.intensity.toFixed(2));
        setControlText("light-range-value", (light.range ?? 0.45).toFixed(2));
        setControlText("light-distance-value", (light.distance ?? 1).toFixed(2));
        setControlText("light-azimuth-value", `${Math.round(light.azimuth ?? -45)}deg`);
        setControlText("light-elevation-value", `${Math.round(light.elevation ?? 45)}deg`);
      }

      function updateSelectedLightFromControl(event) {
        const light = selectedLight();
        if (!light) return;

        const id = event.currentTarget.id;
        const value = event.currentTarget.value;
        if (id === lightControlIds.color) light.color = hexToRgb(value);
        if (id === lightControlIds.intensity) light.intensity = Number(value);
        if (id === lightControlIds.range) light.range = Number(value);
        if (id === lightControlIds.distance) light.distance = Number(value);
        if (id === lightControlIds.azimuth) light.azimuth = Number(value);
        if (id === lightControlIds.elevation) light.elevation = Number(value);

        syncLightControlsFromState();
        scheduleRenderAll("light-control");
      }

      function syncMaterialControlsFromState() {
        setControlValue(materialControlIds.preset, activeMaterialPreset);
        setControlValue(materialControlIds.color, rgbToHex(getRigs().material.color));
        setControlValue(materialControlIds.ior, getRigs().material.ior.toFixed(2));
        setControlValue(materialControlIds.transmission, getRigs().material.transmission.toFixed(2));
        setControlValue(materialControlIds.absorption, getRigs().material.absorption.toFixed(2));
        setControlValue(materialControlIds.thickness, getRigs().material.thickness.toFixed(2));
        setControlValue(materialControlIds.dispersion, getRigs().material.dispersion.toFixed(3));
        setControlValue(materialControlIds.internalReflection, getRigs().material.internalReflection.toFixed(2));
        setControlValue(materialControlIds.surfaceLift, getRigs().material.surfaceLift.toFixed(2));

        setControlText("material-ior-value", getRigs().material.ior.toFixed(2));
        setControlText("material-transmission-value", getRigs().material.transmission.toFixed(2));
        setControlText("material-absorption-value", getRigs().material.absorption.toFixed(2));
        setControlText("material-thickness-value", getRigs().material.thickness.toFixed(2));
        setControlText("material-dispersion-value", getRigs().material.dispersion.toFixed(3));
        setControlText("material-internal-value", getRigs().material.internalReflection.toFixed(2));
        setControlText("material-lift-value", getRigs().material.surfaceLift.toFixed(2));

        const backdropEl = document.getElementById(materialControlIds.backdropDisplace);
        if (backdropEl) backdropEl.checked = getRigs().material.backdropDisplaceTry;
        core.updateBackdropDisplacementFilterScale();
      }

      function applyMaterialPreset(presetId) {
        const values = materialPresets[presetId];
        if (!values) return;

        applyMaterialPresetValues(values);
        activeMaterialPreset = presetId;
        syncMaterialControlsFromState();
        scheduleRenderAll("material-preset");
      }

      function updateMaterialFromControl(event) {
        const id = event.currentTarget.id;
        const value = event.currentTarget.value;

        if (id === materialControlIds.backdropDisplace) {
          getRigs().material.backdropDisplaceTry = !!event.currentTarget.checked;
          core.updateBackdropDisplacementFilterScale();
          syncMaterialControlsFromState();
          scheduleRenderAll("material-backdrop-displace");
          return;
        }

        if (id === materialControlIds.preset) {
          if (value !== "custom") applyMaterialPreset(value);
          return;
        }

        activeMaterialPreset = "custom";

        if (id === materialControlIds.color) getRigs().material.color = hexToRgb(value);
        if (id === materialControlIds.ior) getRigs().material.ior = Number(value);
        if (id === materialControlIds.transmission) getRigs().material.transmission = Number(value);
        if (id === materialControlIds.absorption) getRigs().material.absorption = Number(value);
        if (id === materialControlIds.thickness) getRigs().material.thickness = Number(value);
        if (id === materialControlIds.dispersion) getRigs().material.dispersion = Number(value);
        if (id === materialControlIds.internalReflection) getRigs().material.internalReflection = Number(value);
        if (id === materialControlIds.surfaceLift) getRigs().material.surfaceLift = Number(value);

        core.updateBackdropDisplacementFilterScale();
        syncMaterialControlsFromState();
        scheduleRenderAll("material-control");
      }

      function syncButtonSpecControlsFromState() {
        setControlValue(buttonSpecControlIds.widthScale, getRigs().buttonSpec.widthScale.toFixed(2));
        setControlValue(buttonSpecControlIds.heightScale, getRigs().buttonSpec.heightScale.toFixed(2));
        setControlValue(buttonSpecControlIds.topHeight, getRigs().buttonSpec.topHeight.toFixed(1));
        setControlValue(buttonSpecControlIds.edgeHeight, getRigs().buttonSpec.edgeHeight.toFixed(1));
        setControlValue(buttonSpecControlIds.zRadius, Math.round(getRigs().buttonSpec.zRadius));
        setControlValue(buttonSpecControlIds.shoulderWidth, getRigs().buttonSpec.shoulderWidth.toFixed(2));
        setControlValue(buttonSpecControlIds.bevelWidth, getRigs().buttonSpec.bevelWidth.toFixed(2));

        setControlText("button-width-scale-value", getRigs().buttonSpec.widthScale.toFixed(2));
        setControlText("button-height-scale-value", getRigs().buttonSpec.heightScale.toFixed(2));
        setControlText("button-top-height-value", getRigs().buttonSpec.topHeight.toFixed(1));
        setControlText("button-edge-height-value", getRigs().buttonSpec.edgeHeight.toFixed(1));
        setControlText("button-z-radius-value", `${Math.round(getRigs().buttonSpec.zRadius)}%`);
        setControlText("button-shoulder-value", getRigs().buttonSpec.shoulderWidth.toFixed(2));
        setControlText("button-bevel-value", getRigs().buttonSpec.bevelWidth.toFixed(2));

        setControlValue(shellControlIds.outerColor, rgbToHex(getRigs().shell.outerColor));
        setControlValue(shellControlIds.outerTransparency, getRigs().shell.outerTransparency.toFixed(2));
        setControlValue(shellControlIds.outerWidthScale, getRigs().shell.outerWidthScale.toFixed(2));
        setControlValue(shellControlIds.outerFillOpacity, getRigs().shell.outerFillOpacity.toFixed(2));
        setControlValue(shellControlIds.innerColor, rgbToHex(getRigs().shell.innerColor));
        setControlValue(shellControlIds.innerTransparency, getRigs().shell.innerTransparency.toFixed(2));
        setControlValue(shellControlIds.innerWidthScale, getRigs().shell.innerWidthScale.toFixed(2));
        setControlValue(shellControlIds.insetRingColor, rgbToHex(getRigs().shell.insetRingColor));
        setControlValue(shellControlIds.insetRingTransparency, getRigs().shell.insetRingTransparency.toFixed(3));
        setControlValue(shellControlIds.insetRingWidth, getRigs().shell.insetRingWidth.toFixed(1));

        setControlText("shell-outer-transparency-value", getRigs().shell.outerTransparency.toFixed(2));
        setControlText("shell-outer-width-value", getRigs().shell.outerWidthScale.toFixed(2));
        setControlText("shell-outer-fill-value", getRigs().shell.outerFillOpacity.toFixed(2));
        setControlText("shell-inner-transparency-value", getRigs().shell.innerTransparency.toFixed(2));
        setControlText("shell-inner-width-value", getRigs().shell.innerWidthScale.toFixed(2));
        setControlText("shell-inset-transparency-value", getRigs().shell.insetRingTransparency.toFixed(3));
        setControlText("shell-inset-width-value", getRigs().shell.insetRingWidth.toFixed(1));

        setControlValue(labelControlIds.text, getRigs().label.text);
        setControlValue(labelControlIds.color, rgbToHex(getRigs().label.color));
        setControlValue(labelControlIds.transparency, getRigs().label.transparency.toFixed(2));
        setControlValue(labelControlIds.shadowDarkColor, rgbToHex(getRigs().label.shadowDarkColor));
        setControlValue(labelControlIds.shadowDarkOpacity, getRigs().label.shadowDarkOpacity.toFixed(2));
        setControlValue(labelControlIds.shadowDarkOffsetY, getRigs().label.shadowDarkOffsetY.toFixed(1));
        setControlValue(labelControlIds.shadowDarkBlur, getRigs().label.shadowDarkBlur.toFixed(1));
        setControlValue(labelControlIds.shadowLightColor, rgbToHex(getRigs().label.shadowLightColor));
        setControlValue(labelControlIds.shadowLightOpacity, getRigs().label.shadowLightOpacity.toFixed(2));
        setControlValue(labelControlIds.shadowLightBlur, getRigs().label.shadowLightBlur.toFixed(1));

        setControlText("label-transparency-value", getRigs().label.transparency.toFixed(2));
        setControlText("label-shadow-dark-opacity-value", getRigs().label.shadowDarkOpacity.toFixed(2));
        setControlText("label-shadow-dark-offset-value", getRigs().label.shadowDarkOffsetY.toFixed(1));
        setControlText("label-shadow-dark-blur-value", getRigs().label.shadowDarkBlur.toFixed(1));
        setControlText("label-shadow-light-opacity-value", getRigs().label.shadowLightOpacity.toFixed(2));
        setControlText("label-shadow-light-blur-value", getRigs().label.shadowLightBlur.toFixed(1));
      }

      function updateButtonSpecFromControl(event) {
        const id = event.currentTarget.id;
        const value = event.currentTarget.value;

        if (labelControlIdSet.has(id)) {
          if (id === labelControlIds.text) {
            getRigs().label.text = value.trim() || DEFAULT_LABEL_TEXT;
            core.applyLabelTextToAll();
            syncButtonSpecControlsFromState();
            return;
          }
          if (id === labelControlIds.color) getRigs().label.color = hexToRgb(value);
          else if (id === labelControlIds.shadowDarkColor) getRigs().label.shadowDarkColor = hexToRgb(value);
          else if (id === labelControlIds.shadowLightColor) getRigs().label.shadowLightColor = hexToRgb(value);
          else if (id === labelControlIds.transparency) getRigs().label.transparency = Number(value);
          else if (id === labelControlIds.shadowDarkOpacity) getRigs().label.shadowDarkOpacity = Number(value);
          else if (id === labelControlIds.shadowDarkOffsetY) getRigs().label.shadowDarkOffsetY = Number(value);
          else if (id === labelControlIds.shadowDarkBlur) getRigs().label.shadowDarkBlur = Number(value);
          else if (id === labelControlIds.shadowLightOpacity) getRigs().label.shadowLightOpacity = Number(value);
          else if (id === labelControlIds.shadowLightBlur) getRigs().label.shadowLightBlur = Number(value);

          syncButtonSpecControlsFromState();
          core.applyLabelStylesToAll();
          return;
        }

        if (id === shellControlIds.outerColor) getRigs().shell.outerColor = hexToRgb(value);
        else if (id === shellControlIds.innerColor) getRigs().shell.innerColor = hexToRgb(value);
        else if (id === shellControlIds.insetRingColor) getRigs().shell.insetRingColor = hexToRgb(value);
        else if (id === shellControlIds.outerTransparency) getRigs().shell.outerTransparency = Number(value);
        else if (id === shellControlIds.outerWidthScale) getRigs().shell.outerWidthScale = Number(value);
        else if (id === shellControlIds.outerFillOpacity) getRigs().shell.outerFillOpacity = Number(value);
        else if (id === shellControlIds.innerTransparency) getRigs().shell.innerTransparency = Number(value);
        else if (id === shellControlIds.innerWidthScale) getRigs().shell.innerWidthScale = Number(value);
        else if (id === shellControlIds.insetRingTransparency) getRigs().shell.insetRingTransparency = Number(value);
        else if (id === shellControlIds.insetRingWidth) getRigs().shell.insetRingWidth = Number(value);
        else {
          const num = Number(value);
          if (id === buttonSpecControlIds.widthScale) getRigs().buttonSpec.widthScale = num;
          if (id === buttonSpecControlIds.heightScale) getRigs().buttonSpec.heightScale = num;
          if (id === buttonSpecControlIds.topHeight) getRigs().buttonSpec.topHeight = num;
          if (id === buttonSpecControlIds.edgeHeight) getRigs().buttonSpec.edgeHeight = num;
          if (id === buttonSpecControlIds.zRadius) getRigs().buttonSpec.zRadius = num;
          if (id === buttonSpecControlIds.shoulderWidth) getRigs().buttonSpec.shoulderWidth = num;
          if (id === buttonSpecControlIds.bevelWidth) getRigs().buttonSpec.bevelWidth = num;
        }

        syncButtonSpecControlsFromState();
        scheduleRenderAll("button-spec-control");
      }

      function setupButtonSpecControls() {
        [
          ...Object.values(buttonSpecControlIds),
          ...Object.values(shellControlIds),
          ...Object.values(labelControlIds)
        ].forEach(id => {
          const input = document.getElementById(id);
          if (!input) return;
          input.addEventListener("input", updateButtonSpecFromControl);
        });

        syncButtonSpecControlsFromState();
      }

      function setupMaterialControls() {
        Object.values(materialControlIds).forEach(id => {
          const input = document.getElementById(id);
          if (!input) return;
          if (input.type === "checkbox") {
            input.addEventListener("change", updateMaterialFromControl);
          } else if (input.tagName === "SELECT") {
            input.addEventListener("change", updateMaterialFromControl);
          } else {
            input.addEventListener("input", updateMaterialFromControl);
          }
        });

        syncMaterialControlsFromState();
      }

      function setupLightControls() {
        const select = document.getElementById(lightControlIds.select);
        if (!select) return;

        select.innerHTML = getRigs().lighting.lights
          .map(light => `<option value="${light.id}">${light.id}</option>`)
          .join("");

        select.addEventListener("change", () => syncLightControlsFromState());

        [
          lightControlIds.color,
          lightControlIds.intensity,
          lightControlIds.range,
          lightControlIds.distance,
          lightControlIds.azimuth,
          lightControlIds.elevation
        ].forEach(id => {
          const input = document.getElementById(id);
          if (input) input.addEventListener("input", updateSelectedLightFromControl);
        });

        syncLightControlsFromState();
      }

      setupBackgroundControls();
      setupLightControls();
      setupMaterialControls();
      setupButtonSpecControls();
      setupPresentationControls();

      function boot() {
        scheduleRenderAll("initial");
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
      } else {
        boot();
      }

      window.addEventListener("resize", () => scheduleRenderAll("resize"));

      if (sceneLighting.timeDrift && !core.prefersReducedMotion()) {
        window.setInterval(() => scheduleRenderAll("light-drift"), 3000);
      }
