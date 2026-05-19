/**
 * Optical Capsule — core bake engine (height field, normals, Fresnel, canvas layers, SVG overlay).
 * Provide current scene rigs via getRigs(). No form/DOM control wiring here.
 */
export const DEFAULT_LABEL_TEXT = "Optical Capsule";

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function rgbToHex(color) {
  return `#${color.map(v => clamp(Math.round(v * 255), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

export function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255
  ];
}

/**
 * @param {() => ({ material: object, lighting: object, buttonSpec: object, shell: object, background: object, label: object })} getRigs
 * @param {{ window?: Window, defaultLabelText?: string }} [env]
 */
export function createOpticalCapsuleCore(getRigs, env = {}) {
  const win = env.window ?? (typeof window !== "undefined" ? window : { innerWidth: 1024, innerHeight: 768 });
  const defaultLabelText = env.defaultLabelText ?? DEFAULT_LABEL_TEXT;

      const NS = "http://www.w3.org/2000/svg";
      const smoothstep = (a, b, x) => {
        const t = clamp((x - a) / (b - a), 0, 1);
        return t * t * (3 - 2 * t);
      };
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const normalize = (x, y, z) => {
        const n = Math.hypot(x, y, z) || 1;
        return [x / n, y / n, z / n];
      };

      const degToRad = degrees => degrees * Math.PI / 180;
      const radToDeg = radians => radians * 180 / Math.PI;

      function lightDirectionFromAngles(azimuth, elevation) {
        const az = degToRad(azimuth);
        const el = degToRad(elevation);
        const planar = Math.cos(el);
        return normalize(
          Math.cos(az) * planar,
          Math.sin(az) * planar,
          Math.sin(el)
        );
      }

      function cloneLightingRig(rig) {
        if (typeof structuredClone === "function") return structuredClone(rig);
        return JSON.parse(JSON.stringify(rig));
      }

      function prefersReducedMotion() {
        return win.matchMedia("(prefers-reduced-motion: reduce)").matches;
      }

      function getAnimatedLightRig(timeMs) {
        const t = timeMs || performance.now();
        const driftEnabled = getRigs().lighting.timeDrift && !prefersReducedMotion();
        const copy = cloneLightingRig(getRigs().lighting);

        if (!driftEnabled) return copy;

        const key = copy.lights.find(l => l.id === "key");
        if (key) {
          key.position[0] += Math.sin(t * 0.00008) * 0.035;
          key.position[1] += Math.cos(t * 0.00006) * 0.022;
          key.intensity += Math.sin(t * 0.00005) * 0.035;
        }

        const cyan = copy.lights.find(l => l.id === "cyan-rim");
        if (cyan) {
          cyan.intensity += Math.sin(t * 0.00011) * 0.045;
        }

        const violet = copy.lights.find(l => l.id === "violet-fill");
        if (violet) {
          violet.position[0] += Math.sin(t * 0.00004) * 0.025;
          violet.intensity += Math.cos(t * 0.00007) * 0.03;
        }

        return copy;
      }

      function getElementScenePosition(rect) {
        return [
          (rect.left + rect.width * 0.5) / win.innerWidth,
          (rect.top + rect.height * 0.5) / win.innerHeight,
          0
        ];
      }

      function lightVectorForElement(light, rect) {
        if (Array.isArray(light.direction)) {
          return normalize(light.direction[0], light.direction[1], light.direction[2]);
        }

        if (Number.isFinite(light.azimuth) && Number.isFinite(light.elevation)) {
          return lightDirectionFromAngles(light.azimuth, light.elevation);
        }

        const c = getElementScenePosition(rect);
        return normalize(
          light.position[0] - c[0],
          light.position[1] - c[1],
          light.position[2] - c[2]
        );
      }

      function buildElementLighting(rect, timeMs = 0) {
        const rig = getRigs().lighting.enabled ? getAnimatedLightRig(timeMs) : cloneLightingRig(getRigs().lighting);
        const lights = rig.lights.map(light => ({
          ...light,
          direction: lightVectorForElement(light, rect)
        }));

        return {
          ambient: rig.ambient,
          lights
        };
      }

      function capsuleSDF(x, y, w, h) {
        const r = h * 0.5;
        const ax = r;
        const bx = w - r;
        const pax = x - ax;
        const bay = 0;
        const bax = bx - ax;
        const t = clamp((pax * bax + (y - r) * bay) / (bax * bax + bay * bay + 1e-5), 0, 1);
        const dx = pax - bax * t;
        const dy = y - r;
        return Math.hypot(dx, dy) - r;
      }

      function shiftedCapsuleSDF(x, y, w, h, inset) {
        return capsuleSDF(x - inset, y - inset, w - inset * 2, h - inset * 2);
      }

      function params(w, h, rect, timeMs = 0) {
        const ior = getRigs().material.ior;
        const F0 = ((ior - 1) / (ior + 1)) ** 2;
        const lighting = buildElementLighting(rect, timeMs);
        const zUnit = h / 112;
        const zProfile = {
          heights: [getRigs().buttonSpec.topHeight, getRigs().buttonSpec.edgeHeight],
          radii: [0, getRigs().buttonSpec.zRadius],
          unit: zUnit,
          topHeight: getRigs().buttonSpec.topHeight * zUnit,
          sideHeight: getRigs().buttonSpec.edgeHeight * zUnit,
          shoulderRadius: h * getRigs().buttonSpec.shoulderWidth
        };
        return {
          w,
          h,
          backgroundShowsThrough: getRigs().background.mode === "image",
          r: h * 0.5,
          faceInset: zProfile.shoulderRadius,
          bevelWidth: h * getRigs().buttonSpec.bevelWidth,
          zScale: zProfile.topHeight,
          zProfile,
          roughness: getRigs().material.roughness,
          ior,
          F0,
          materialColor: getRigs().material.color,
          reflectivity: getRigs().material.reflectivity,
          transmission: getRigs().material.transmission,
          thickness: getRigs().material.thickness,
          absorption: getRigs().material.absorption,
          dispersion: getRigs().material.dispersion,
          internalReflection: getRigs().material.internalReflection,
          surfaceLift: getRigs().material.surfaceLift * h,
          clearcoat: getRigs().material.clearcoat,
          clearcoatRoughness: getRigs().material.clearcoatRoughness,
          lighting,
          view: [0, 0, 1]
        };
      }

      function zProfileSample(edgeDepth, p) {
        const radius = Math.max(1, p.zProfile.shoulderRadius);
        const t = clamp(edgeDepth / radius, 0, 1);
        const roundness = clamp(p.zProfile.radii[1] / 100, 0, 1);
        const circular = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
        const linear = t;
        const shaped = linear * (1 - roundness) + circular * roundness;
        const z = p.zProfile.sideHeight + (p.zProfile.topHeight - p.zProfile.sideHeight) * shaped;

        return {
          z,
          t,
          shoulder: 1 - smoothstep(0.86, 1, t),
          face: smoothstep(0.92, 1, t)
        };
      }

      function heightField(x, y, p) {
        const dOuter = capsuleSDF(x, y, p.w, p.h);
        if (dOuter > 1) return { z: 0, cavity: 1, inside: false };

        const dFace = shiftedCapsuleSDF(x, y, p.w, p.h, p.faceInset);
        const edgeDepth = clamp(-dOuter, 0, p.zProfile.shoulderRadius);
        const profile = zProfileSample(edgeDepth, p);
        const face = Math.max(profile.face, smoothstep(0, -p.bevelWidth, dFace));
        const bevelBand = profile.shoulder * smoothstep(p.bevelWidth, -p.bevelWidth, dFace);
        const upperBevel = bevelBand * smoothstep(p.h * 0.54, p.h * 0.12, y);
        const lowerBevel = bevelBand * smoothstep(p.h * 0.46, p.h * 0.9, y);

        const z = profile.z;

        const cavity = smoothstep(-p.bevelWidth * 0.3, -p.bevelWidth * 1.25, dFace);
        return {
          z,
          cavity,
          inside: dOuter <= 0,
          dOuter,
          dFace,
          upperBevel,
          lowerBevel,
          face,
          profileT: profile.t,
          shoulder: profile.shoulder
        };
      }

      function normalAt(x, y, p) {
        const eps = Math.max(0.75, p.h * 0.008);
        const zL = heightField(x - eps, y, p).z;
        const zR = heightField(x + eps, y, p).z;
        const zU = heightField(x, y - eps, p).z;
        const zD = heightField(x, y + eps, p).z;
        return normalize(-(zR - zL), -(zD - zU), eps * 2);
      }

      function capSpecMask(x, y, p) {
        const cx = p.w - p.r;
        const cy = p.h * 0.5;
        const ux = (x - cx) / p.r;
        const uy = (y - cy) / p.r;
        const rho = Math.hypot(ux, uy);
        const upperHemisphere = smoothstep(0.08, -0.72, uy);
        const rightShoulder = smoothstep(-0.22, 0.72, ux);
        const outerArc = smoothstep(0.58, 0.78, rho) * smoothstep(1.02, 0.84, rho);
        const flattenedFaceCut = 1 - smoothstep(p.w - p.r * 1.04, p.w - p.r * 0.46, x);
        return outerArc * upperHemisphere * rightShoulder * flattenedFaceCut;
      }

      function weightedLightColor(lighting, ids, fallback) {
        let color = [0, 0, 0];
        let total = 0;

        for (const light of lighting.lights) {
          const weight = ids.includes(light.id) ? light.intensity : light.intensity * 0.18;
          color[0] += light.color[0] * weight;
          color[1] += light.color[1] * weight;
          color[2] += light.color[2] * weight;
          total += weight;
        }

        if (total <= 0) return fallback;

        return [
          color[0] / total,
          color[1] / total,
          color[2] / total
        ];
      }

      function mixLightingColor(lighting, role) {
        if (role === "specular") return weightedLightColor(lighting, ["key"], [1, 0.96, 0.9]);
        if (role === "rim") return weightedLightColor(lighting, ["cyan-rim", "violet-fill"], [0.16, 0.65, 1]);
        if (role === "caustic") return weightedLightColor(lighting, ["cyan-rim"], [0.12, 0.72, 1]);

        const ambient = lighting.ambient;
        let color = [
          ambient.color[0] * ambient.intensity,
          ambient.color[1] * ambient.intensity,
          ambient.color[2] * ambient.intensity
        ];
        let total = ambient.intensity;

        for (const light of lighting.lights) {
          const weight = light.intensity * 0.28;
          color[0] += light.color[0] * weight;
          color[1] += light.color[1] * weight;
          color[2] += light.color[2] * weight;
          total += weight;
        }

        if (total <= 0) return [0.08, 0.16, 0.28];
        return [color[0] / total, color[1] / total, color[2] / total];
      }

      function beerLambert(transmission, absorption, depth) {
        return transmission * Math.exp(-absorption * depth);
      }

      function refractVector(I, N, eta) {
        const cosI = clamp(-dot(N, I), -1, 1);
        const sinT2 = eta * eta * (1 - cosI * cosI);
        if (sinT2 > 1) return null;
        const cosT = Math.sqrt(1 - sinT2);
        return normalize(
          eta * I[0] + (eta * cosI - cosT) * N[0],
          eta * I[1] + (eta * cosI - cosT) * N[1],
          eta * I[2] + (eta * cosI - cosT) * N[2]
        );
      }

      function reflectVector(D, N) {
        const ddn = dot(D, N);
        return normalize(
          D[0] - 2 * ddn * N[0],
          D[1] - 2 * ddn * N[1],
          D[2] - 2 * ddn * N[2]
        );
      }

      /**
       * Trace up to four internal round-trips (bottom Fresnel reflect + march to top +
       * glass→air refract or TIR), matching the X–Z diagram logic in spirit.
       * Returns additive energy toward the camera for the transmission / internal-bounce channel.
       */
      function internalMultiBounceEnergy(x, y, p, Nsurf, L, lightEnergy) {
        const hf0 = heightField(x, y, p);
        if (!hf0.inside) return 0;

        const incidentAir = normalize(-L[0], -L[1], -L[2]);
        const dGlass = refractVector(incidentAir, Nsurf, 1 / p.ior);
        if (!dGlass || dGlass[2] >= -1e-6) return 0;

        const eps = Math.max(0.06, p.h * 0.0055);
        const P = [x, y, Math.max(eps, hf0.z - eps)];
        let d = dGlass;
        let weight = lightEnergy * p.internalReflection * p.transmission * 0.22;
        let accum = 0;
        const V = p.view;
        const step = Math.max(0.22, p.h * 0.012);
        const maxBounces = 4;
        const pathSpread = Math.hypot(dGlass[0], dGlass[1]);
        const shoulderBounce = clamp(
          hf0.shoulder * 0.85 + hf0.lowerBevel * 0.55 + (1 - hf0.face) * 0.18,
          0,
          1
        );

        for (let bounce = 0; bounce < maxBounces; bounce += 1) {
          if (d[2] >= -1e-5 || weight < 1e-5) break;
          const tBot = -P[2] / d[2];
          if (tBot <= 0 || tBot > p.h * 80) break;
          P[0] += d[0] * tBot;
          P[1] += d[1] * tBot;
          P[2] = 0;

          const cosIBot = clamp(dot([0, 0, 1], normalize(-d[0], -d[1], -d[2])), 0, 1);
          const Rbot = p.F0 + (1 - p.F0) * Math.pow(1 - cosIBot, 5);
          weight *= Rbot;
          d = normalize(d[0], d[1], -d[2]);

          let hitTop = false;
          let marched = 0;
          const marchLimit = p.h * 16;
          while (marched < marchLimit) {
            P[0] += d[0] * step;
            P[1] += d[1] * step;
            P[2] += d[2] * step;
            marched += step;
            if (capsuleSDF(P[0], P[1], p.w, p.h) > 1.25) break;
            const hf = heightField(P[0], P[1], p);
            if (!hf.inside) break;
            if (P[2] >= hf.z - eps) {
              P[2] = Math.max(eps * 0.35, hf.z - eps * 0.65);
              hitTop = true;
              break;
            }
          }
          if (!hitTop) break;

          const Ntop = normalAt(P[0], P[1], p);
          const Nout = normalize(Ntop[0], Ntop[1], Ntop[2]);
          const negN = [-Nout[0], -Nout[1], -Nout[2]];
          const dExit = refractVector(d, negN, p.ior);
          if (!dExit) {
            d = reflectVector(d, Nout);
            const cosR = clamp(Math.abs(dot(d, Nout)), 0, 1);
            const Rtop = p.F0 + (1 - p.F0) * Math.pow(1 - cosR, 5);
            weight *= Rtop;
            continue;
          }
          const cosT = clamp(Math.abs(dot(normalize(d[0], d[1], d[2]), Nout)), 0, 1);
          const Rtop = p.F0 + (1 - p.F0) * Math.pow(1 - cosT, 5);
          const Ttop = clamp(1 - Rtop, 0.06, 1);
          const towardCam = clamp(dot(dExit, V), 0, 1);
          accum += weight * Ttop * Math.pow(towardCam, 2.35) * pathSpread * shoulderBounce;
          break;
        }
        return accum;
      }

      function shade(x, y, p) {
        const hf = heightField(x, y, p);
        if (!hf.inside) return null;

        const N = normalAt(x, y, p);
        const V = p.view;
        const NoV = clamp(dot(N, V), 0, 1);
        const fresnel = p.F0 + (1 - p.F0) * Math.pow(1 - NoV, 5);

        let spec = 0;
        let internalReflection = 0;
        let rimColor = [0, 0, 0];
        let transmissionColor = [
          p.lighting.ambient.color[0] * p.lighting.ambient.intensity,
          p.lighting.ambient.color[1] * p.lighting.ambient.intensity,
          p.lighting.ambient.color[2] * p.lighting.ambient.intensity
        ];

        for (const light of p.lighting.lights) {
          const L = light.direction;
          const H = normalize(L[0] + V[0], L[1] + V[1], L[2] + V[2]);
          const NoL = clamp(dot(N, L), 0, 1);
          const NoH = clamp(dot(N, H), 0, 1);
          const range = clamp(light.range ?? 0.45, 0.05, 1.2);
          const distance = Math.max(0.35, light.distance ?? 1);
          const distanceAttenuation = clamp(1 / (distance * distance), 0.16, 8);
          const lightEnergy = light.intensity * distanceAttenuation;
          const roughPower = (0.85 / Math.max(0.006, p.roughness * p.roughness)) / (0.56 + range * 1.8);
          const clearcoatPower = (0.42 / Math.max(0.002, p.clearcoatRoughness * p.clearcoatRoughness)) / (0.62 + range * 1.35);

          const primarySpec =
            Math.pow(NoH, roughPower) *
            NoL *
            lightEnergy *
            light.specular *
            (0.48 + fresnel * 7.4) *
            p.reflectivity;

          const clearcoatSpec =
            Math.pow(NoH, clearcoatPower) *
            NoL *
            lightEnergy *
            light.specular *
            p.clearcoat *
            (0.32 + fresnel * 9.0);

          spec += primarySpec + clearcoatSpec;

          internalReflection += internalMultiBounceEnergy(x, y, p, N, L, lightEnergy);

          rimColor[0] += light.color[0] * lightEnergy * fresnel;
          rimColor[1] += light.color[1] * lightEnergy * fresnel;
          rimColor[2] += light.color[2] * lightEnergy * fresnel;
          transmissionColor[0] += light.color[0] * lightEnergy * p.transmission;
          transmissionColor[1] += light.color[1] * lightEnergy * p.transmission;
          transmissionColor[2] += light.color[2] * lightEnergy * p.transmission;
        }

        const rimBase = mixLightingColor(p.lighting, "rim");
        rimColor = [
          Math.max(rimColor[0], rimBase[0] * fresnel),
          Math.max(rimColor[1], rimBase[1] * fresnel),
          Math.max(rimColor[2], rimBase[2] * fresnel)
        ];
        const rim = Math.pow(1 - NoV, 2.2) * (0.6 + fresnel * 5.5);

        const normalSlope = Math.hypot(N[0], N[1]);
        const materialSpecVisibility =
          clamp(normalSlope * 2.2, 0, 1) * 0.72 +
          hf.shoulder * 0.08 +
          hf.face * 0.006;
        const specField = spec * materialSpecVisibility;

        const edge = smoothstep(-p.h * 0.03, -p.h * 0.16, capsuleSDF(x, y, p.w, p.h));
        const rimField = rim * (1 - edge) * smoothstep(p.h * 0.22, p.h * 0.94, y);
        const cavity = hf.cavity;
        const seeThrough = p.backgroundShowsThrough;
        const normalizedHeight = clamp(hf.z / Math.max(1, p.zScale), 0, 1);
        const depth = normalizedHeight * p.thickness + cavity * 0.28;
        const opticalDepth = clamp(depth * p.absorption, 0, 1);
        const transmittance = beerLambert(p.transmission, p.absorption, depth);
        const materialFilter = [
          beerLambert(p.materialColor[0], p.absorption, depth),
          beerLambert(p.materialColor[1], p.absorption, depth),
          beerLambert(p.materialColor[2], p.absorption, depth)
        ];
        const pocket = (1 - cavity * 0.82) * transmittance * (
          Math.exp(-((x - p.w * 0.2) ** 2 / (p.w * p.w * 0.018) + (y - p.h * 0.78) ** 2 / (p.h * p.h * 0.05))) * 0.22 +
          Math.exp(-((x - p.w * 0.58) ** 2 / (p.w * p.w * 0.016) + (y - p.h * 0.82) ** 2 / (p.h * p.h * 0.035))) * 0.18
        );
        const internalPocket = internalReflection * transmittance * (0.55 + hf.shoulder * 0.8);
        const cavityDark = cavity * (1 - transmittance) * (0.62 + p.thickness * 0.28);
        const lowerTransmission = hf.lowerBevel * transmittance * p.thickness * Math.max(0, -N[1]);
        const specularColor = mixLightingColor(p.lighting, "specular");

        return {
          spec: specField,
          rim: rimField,
          pocket: pocket + internalPocket,
          fresnel,
          opticalDepth,
          cavityDark,
          lowerTransmission,
          rimColor,
          transmissionColor: [
            transmissionColor[0] * (0.35 + materialFilter[0] * 2.2),
            transmissionColor[1] * (0.35 + materialFilter[1] * 2.2),
            transmissionColor[2] * (0.35 + materialFilter[2] * 2.2)
          ],
          internalReflection,
          specularColor
        };
      }

      function fieldPath(w, h, step, threshold, sample) {
        let d = "";
        for (let y = 0; y < h; y += step) {
          let start = null;
          for (let x = 0; x <= w; x += step) {
            const v = x < w ? sample(x + step * 0.5, y + step * 0.5) : 0;
            if (v >= threshold && start === null) start = x;
            if ((v < threshold || x >= w) && start !== null) {
              const end = x;
              if (end - start >= step) {
                d += `M ${start.toFixed(1)} ${y.toFixed(1)} H ${end.toFixed(1)} V ${(y + step).toFixed(1)} H ${start.toFixed(1)} Z `;
              }
              start = null;
            }
          }
        }
        return d;
      }

      function layerTexture(w, h, p, layer) {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const image = ctx.createImageData(w, h);
        const data = image.data;

        for (let y = 0; y < h; y += 1) {
          for (let x = 0; x < w; x += 1) {
            const s = shade(x + 0.5, y + 0.5, p);
            const i = (y * w + x) * 4;
            if (!s) {
              data[i + 3] = 0;
              continue;
            }

            let r = 0;
            let g = 0;
            let b = 0;
            let alpha = 0;

            if (layer === "spec-tail") {
              const v = clamp(s.spec * 0.82, 0, 1);
              r = 255 * s.specularColor[0];
              g = 255 * s.specularColor[1];
              b = 255 * s.specularColor[2];
              alpha = clamp(v * 0.32, 0, 0.32);
            } else if (layer === "spec-core") {
              const v = clamp(s.spec * 0.92, 0, 1);
              r = 255 * clamp(s.specularColor[0] * 1.08, 0, 1);
              g = 255 * clamp(s.specularColor[1] * 1.08, 0, 1);
              b = 255 * clamp(s.specularColor[2] * 1.08, 0, 1);
              alpha = clamp((v - 0.48) * 0.42, 0, 0.18);
            } else if (layer === "rim") {
              const v = clamp(s.rim * 1.15, 0, 1);
              r = 255 * clamp(s.rimColor[0] * (1.15 + s.fresnel * 0.9), 0, 1);
              g = 255 * clamp(s.rimColor[1] * (1.15 + s.fresnel * 0.9), 0, 1);
              b = 255 * clamp(s.rimColor[2] * (1.15 + s.fresnel * 0.9), 0, 1);
              alpha = clamp(v * 0.72, 0, 0.76);
            } else if (layer === "transmission") {
              const v = clamp(s.pocket * 3.0, 0, 1);
              r = 255 * clamp(s.transmissionColor[0] * 0.9, 0, 1);
              g = 255 * clamp(s.transmissionColor[1] * 0.9, 0, 1);
              b = 255 * clamp(s.transmissionColor[2] * 0.9, 0, 1);
              alpha = clamp(v * 0.52, 0, 0.48);
            } else if (layer === "cavity") {
              if (p.backgroundShowsThrough) {
                data[i + 3] = 0;
                continue;
              }
              const v = clamp(s.cavityDark, 0, 1);
              r = 3;
              g = 5;
              b = 10;
              alpha = clamp(v * 0.24, 0, 0.28);
            }

            data[i] = clamp(r, 0, 255);
            data[i + 1] = clamp(g, 0, 255);
            data[i + 2] = clamp(b, 0, 255);
            data[i + 3] = alpha * 255;
          }
        }

        ctx.putImageData(image, 0, 0);

        const blurCanvas = document.createElement("canvas");
        blurCanvas.width = w;
        blurCanvas.height = h;
        const blurCtx = blurCanvas.getContext("2d");
        const blur =
          layer === "spec-core" ? clamp(h * 0.002, 0.08, 0.35) :
          layer === "cavity" ? clamp(h * 0.01, 0.4, 1.6) :
          layer === "transmission" ? clamp(h * 0.025, 1.2, 4.4) :
          clamp(h * 0.006, 0.3, 1.0);
        blurCtx.filter = `blur(${blur}px)`;
        blurCtx.drawImage(canvas, 0, 0);
        return blurCanvas.toDataURL("image/png");
      }

      function underlayLayout(w, h, p, keyDirection) {
        const lift = p.surfaceLift;
        const [sampleOx, sampleOy] = shadowGroundOffset(lift, keyDirection);
        const projX = -sampleOx;
        const projY = -sampleOy;
        const penumbra = h * (0.07 + lift / Math.max(1, h) * 0.2 + (p.lighting.lights[0]?.range ?? 0.36) * 0.09);
        const padLeft = Math.ceil(h * 0.72 + Math.max(0, -projX) + penumbra * 2.2);
        const padRight = Math.ceil(Math.max(0, projX) + penumbra * 2.2 + w * 0.04);
        const padTop = Math.ceil(h * 0.54);
        const padBottom = Math.ceil(Math.max(0, projY) + penumbra * 2.2 + h * 0.12);
        return {
          padLeft,
          padTop,
          padRight,
          padBottom,
          penumbra,
          projX,
          projY,
          width: Math.round(padLeft + w + padRight),
          height: Math.round(padTop + h + padBottom)
        };
      }

      /** keyDirection points surface → light (same as Phong L). Shadow on the page falls along −L. */
      function shadowGroundOffset(lift, lightToward) {
        const lz = Math.max(0.18, lightToward[2]);
        return [
          lift * lightToward[0] / lz,
          lift * lightToward[1] / lz
        ];
      }

      function capsuleCastShadow(px, py, w, h, p, keyDirection, penumbra) {
        const [ox, oy] = shadowGroundOffset(p.surfaceLift, keyDirection);
        const taps = [
          [0, 0],
          [penumbra * 0.42, 0],
          [-penumbra * 0.42, 0],
          [0, penumbra * 0.42],
          [0, -penumbra * 0.42],
          [penumbra * 0.3, penumbra * 0.3],
          [-penumbra * 0.3, penumbra * 0.3]
        ];
        let sum = 0;
        for (const [dx, dy] of taps) {
          const d = capsuleSDF(px + ox + dx, py + oy + dy, w, h);
          sum += 1 - smoothstep(0, penumbra, d);
        }
        return sum / taps.length;
      }

      function capsuleContactShadow(px, py, w, h) {
        const d = capsuleSDF(px, py, w, h);
        const alongBottom = smoothstep(h * 0.68, h * 0.98, py);
        const shell = 1 - smoothstep(-h * 0.015, h * 0.055, d);
        return shell * alongBottom;
      }

      function blurCanvasSource(source, blurPx) {
        const blurCanvas = document.createElement("canvas");
        blurCanvas.width = source.width;
        blurCanvas.height = source.height;
        const blurCtx = blurCanvas.getContext("2d");
        blurCtx.filter = `blur(${blurPx}px)`;
        blurCtx.drawImage(source, 0, 0);
        return blurCanvas;
      }

      function underlayTexture(w, h, p) {
        const keyLight = p.lighting.lights.find(light => light.id === "key") || p.lighting.lights[0];
        const keyDirection = keyLight?.direction || [0.5, -0.5, 0.707];
        const layout = underlayLayout(w, h, p, keyDirection);
        const { padLeft, padTop, penumbra, width: uw, height: uh } = layout;
        const liftGain = 0.38 + p.surfaceLift / Math.max(1, h) * 0.82;

        const shadowCanvas = document.createElement("canvas");
        shadowCanvas.width = uw;
        shadowCanvas.height = uh;
        const shadowCtx = shadowCanvas.getContext("2d", { willReadFrequently: true });
        const shadowImage = shadowCtx.createImageData(uw, uh);
        const shadowData = shadowImage.data;

        const seeThrough = p.backgroundShowsThrough;
        const castStrength = seeThrough ? 0.48 : 0.82;
        const contactStrength = seeThrough ? 0.18 : 0.34;

        for (let y = 0; y < uh; y += 1) {
          for (let x = 0; x < uw; x += 1) {
            const bx = x - padLeft;
            const by = y - padTop;
            const cast = capsuleCastShadow(bx, by, w, h, p, keyDirection, penumbra);
            const contact = capsuleContactShadow(bx, by, w, h);
            const shadow = clamp(cast * castStrength * liftGain + contact * contactStrength, 0, 1);
            const i = (y * uw + x) * 4;
            shadowData[i] = 0;
            shadowData[i + 1] = 0;
            shadowData[i + 2] = 0;
            shadowData[i + 3] = shadow * 255;
          }
        }

        shadowCtx.putImageData(shadowImage, 0, 0);
        const shadowBlurBase = clamp(h * 0.032, 1.1, 5.5);
        const shadowBlurPx = seeThrough ? shadowBlurBase * 2.8 : shadowBlurBase;
        const blurredShadow = blurCanvasSource(shadowCanvas, shadowBlurPx);

        const causticColor = mixLightingColor(p.lighting, "caustic");
        const rimLight = p.lighting.lights.find(light => light.id === "cyan-rim") || p.lighting.lights[0];
        const causticDriftX = rimLight ? rimLight.direction[0] * h * 0.22 : 0;
        const causticDriftY = rimLight ? rimLight.direction[1] * h * 0.14 : 0;

        const composite = document.createElement("canvas");
        composite.width = uw;
        composite.height = uh;
        const compositeCtx = composite.getContext("2d");
        compositeCtx.drawImage(blurredShadow, 0, 0);

        const causticCanvas = document.createElement("canvas");
        causticCanvas.width = uw;
        causticCanvas.height = uh;
        const causticCtx = causticCanvas.getContext("2d", { willReadFrequently: true });
        const causticImage = causticCtx.createImageData(uw, uh);
        const causticData = causticImage.data;

        const causticSigmaX = seeThrough ? w * 0.09 : w * 0.34;
        const causticSigmaY = seeThrough ? h * 0.06 : h * 0.2;
        const causticPeakAlpha = seeThrough ? 0.18 : 0.55;

        for (let y = 0; y < uh; y += 1) {
          for (let x = 0; x < uw; x += 1) {
            const bx = x - padLeft;
            const by = y - padTop;
            const sx = bx + h * 0.18;
            const sy = by - h * 0.22;
            const lower = sy > h * 0.56 ? shade(clamp(sx, 0, w - 1), clamp(sy, 0, h - 1), p) : null;
            const normalizedX = (x - uw * 0.32 - causticDriftX) / causticSigmaX;
            const normalizedY = (y - uh * 0.55 - causticDriftY) / causticSigmaY;
            const causticShape = Math.exp(-(normalizedX * normalizedX + normalizedY * normalizedY));
            const transmitted = (lower?.lowerTransmission || 0) * p.dispersion;
            const caustic = clamp(causticShape * (p.transmission * p.thickness * 1.35 + transmitted * 3.4), 0, 1);
            const i = (y * uw + x) * 4;
            causticData[i] = clamp(caustic * causticColor[0] * 255, 0, 255);
            causticData[i + 1] = clamp(caustic * causticColor[1] * 255, 0, 255);
            causticData[i + 2] = clamp(caustic * causticColor[2] * 255, 0, 255);
            causticData[i + 3] = clamp(caustic * 0.9, 0, 255) * causticPeakAlpha;
          }
        }

        causticCtx.putImageData(causticImage, 0, 0);
        const blurredCaustic = blurCanvasSource(causticCanvas, clamp(h * 0.04, 1.4, 6.5));
        compositeCtx.globalCompositeOperation = "screen";
        compositeCtx.drawImage(blurredCaustic, 0, 0);
        compositeCtx.globalCompositeOperation = "source-over";

        return {
          href: composite.toDataURL("image/png"),
          width: uw,
          height: uh,
          padLeft,
          padTop
        };
      }

      function makeSVG(button, w, h, rect, timeMs) {
        const p = params(w, h, rect, timeMs);
        const id = `oc-${Math.random().toString(36).slice(2)}`;
        const cavity = layerTexture(w, h, p, "cavity");
        const transmission = layerTexture(w, h, p, "transmission");
        const rim = layerTexture(w, h, p, "rim");
        const specTail = layerTexture(w, h, p, "spec-tail");
        const specCore = layerTexture(w, h, p, "spec-core");

        const faceInset = p.faceInset;
        const faceW = w - faceInset * 2;
        const faceH = h - faceInset * 2;
        const faceR = faceH / 2;
        const outerStroke = shellStrokeWidth(h, getRigs().shell.outerWidthScale, 0.01, 2.5);
        const innerStroke = shellStrokeWidth(h, getRigs().shell.innerWidthScale, 0.012, 2.8);
        const outerStrokeVisible = outerStroke > 0 && getRigs().shell.outerTransparency > 0;
        const innerStrokeVisible = innerStroke > 0 && getRigs().shell.innerTransparency > 0;
        const outerStrokePaint = rgbaString(getRigs().shell.outerColor, 1);
        const innerStrokePaint = rgbaString(getRigs().shell.innerColor, 1);
        const outerStrokeOpacity = getRigs().shell.outerTransparency;
        const innerStrokeOpacity = getRigs().shell.innerTransparency;

        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("class", "optical-svg");
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("aria-hidden", "true");
        svg.innerHTML = `
          <defs>
            <clipPath id="${id}-clip">
              <rect x="0" y="0" width="${w}" height="${h}" rx="${h / 2}" ry="${h / 2}"></rect>
            </clipPath>
          </defs>
          <g clip-path="url(#${id}-clip)">
            <rect data-layer="outer shell" x="0" y="0" width="${w}" height="${h}" rx="${h / 2}" fill="${p.backgroundShowsThrough ? "none" : `rgba(3,4,9,${getRigs().shell.outerFillOpacity.toFixed(3)})`}" stroke="${outerStrokeVisible ? outerStrokePaint : "none"}" stroke-opacity="${outerStrokeVisible ? outerStrokeOpacity : 0}" stroke-width="${outerStrokeVisible ? outerStroke : 0}"></rect>
            ${p.backgroundShowsThrough ? "" : `<image data-layer="inner dark cavity" href="${cavity}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none"></image>`}
            <image class="screen" data-layer="internal transmission pockets" href="${transmission}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none"></image>
            <image class="rim" data-layer="Fresnel rim" href="${rim}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none"></image>
            ${innerStrokeVisible ? `<rect data-layer="inner face boundary" x="${faceInset}" y="${faceInset}" width="${faceW}" height="${faceH}" rx="${faceR}" fill="none" stroke="${innerStrokePaint}" stroke-opacity="${innerStrokeOpacity}" stroke-width="${innerStroke}"></rect>` : ""}
            <image class="screen" data-layer="specular tail" href="${specTail}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none"></image>
            <image class="screen" data-layer="specular core" href="${specCore}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none"></image>
          </g>
        `;
        button.appendChild(svg);
      }

      function makeUnderlay(stage, w, h, rect, timeMs) {
        const p = params(w, h, rect, timeMs);
        const underlay = underlayTexture(w, h, p);
        stage.style.setProperty("--underlay-pad-left", `${underlay.padLeft}px`);
        stage.style.setProperty("--underlay-pad-top", `${underlay.padTop}px`);
        stage.style.setProperty("--underlay-w", `${underlay.width}px`);
        stage.style.setProperty("--underlay-h", `${underlay.height}px`);
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("class", "underlay-svg");
        svg.setAttribute("viewBox", `0 0 ${underlay.width} ${underlay.height}`);
        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("aria-hidden", "true");
        svg.innerHTML = `<image data-layer="capsule projected shadow and caustic pool" href="${underlay.href}" x="0" y="0" width="${underlay.width}" height="${underlay.height}" preserveAspectRatio="none"></image>`;
        stage.prepend(svg);
      }

      function renderCrossSection(timeMs = performance.now()) {
        const host = document.querySelector("#xz-cross-section");
        if (!host) return;

        const w = 360;
        const h = 112;
        const p = params(w, h, { left: 0, top: 0, width: w, height: h }, timeMs);
        const sliceY = h * 0.5;
        const svgW = 860;
        const marginX = 58;
        const baseline = 540;
        const pagePlaneY = 600;
        const svgH = pagePlaneY + 36;
        const zGain = 135 / p.zScale;
        const plotW = svgW - marginX * 2;
        const mapX = x => marginX + (x / w) * plotW;
        const mapZ = z => baseline - z * zGain;
        const keyLight = p.lighting.lights.find(light => light.id === "key") || p.lighting.lights[0];
        const keyDirection = keyLight?.direction || [0.5, -0.5, 0.707];
        const projectedGroundX = x => mapX(clamp(x - keyDirection[0] / Math.max(0.18, keyDirection[2]) * p.surfaceLift, -w * 0.2, w * 1.2));

        const xy = {
          x: 58,
          y: 54,
          w: 350,
          h: 178
        };
        const xyScale = Math.min((xy.w - 28) / w, (xy.h - 72) / h);
        const xyW = w * xyScale;
        const xyH = h * xyScale;
        const xyX = xy.x + (xy.w - xyW) * 0.5;
        const xyY = xy.y + 54;
        const xyHitX = xyX + (w - p.faceInset - p.bevelWidth * 0.48) * xyScale;
        const xyHitY = xyY + sliceY * xyScale;
        const xyLightStartX = xyHitX + keyDirection[0] * 84;
        const xyLightStartY = xyHitY + keyDirection[1] * 84;
        const xyShadowEndX = xyHitX - keyDirection[0] / Math.max(0.18, keyDirection[2]) * p.surfaceLift * xyScale;
        const xyShadowEndY = xyHitY - keyDirection[1] / Math.max(0.18, keyDirection[2]) * p.surfaceLift * xyScale;

        const yz = {
          x: 500,
          y: 54,
          w: 302,
          h: 178,
          base: 196
        };
        const yzPlotW = yz.w - 62;
        const yzGain = 92 / p.zScale;
        const mapYSection = y => yz.x + 32 + (y / h) * yzPlotW;
        const mapYZ = z => yz.base - z * yzGain;

        const ySamples = [];
        for (let y = 0; y <= h; y += 1.5) {
          const hf = heightField(w * 0.5, y, p);
          ySamples.push({
            y,
            z: hf.inside ? hf.z : 0
          });
        }
        const yzTopPath = ySamples
          .map((sample, index) => `${index === 0 ? "M" : "L"} ${mapYSection(sample.y).toFixed(2)} ${mapYZ(sample.z).toFixed(2)}`)
          .join(" ");
        const yzMaterialPath = `${yzTopPath} L ${mapYSection(h).toFixed(2)} ${yz.base.toFixed(2)} L ${mapYSection(0).toFixed(2)} ${yz.base.toFixed(2)} Z`;
        const yzFaceTop = mapYZ(heightField(w * 0.5, h * 0.5, p).z);
        const yzFaceUpper = mapYSection(p.faceInset);
        const yzFaceLower = mapYSection(h - p.faceInset);
        const yzSampleY = p.faceInset + p.bevelWidth * 0.6;
        const yzSampleField = heightField(w * 0.5, yzSampleY, p);
        const yzSampleNormal = normalAt(w * 0.5, yzSampleY, p);
        const yzHitX = mapYSection(yzSampleY);
        const yzHitY = mapYZ(yzSampleField.z);
        const yzIncidentStartX = yzHitX + keyDirection[1] * 82;
        const yzIncidentStartY = yzHitY - keyDirection[2] * 82;
        const yzIncident = normalize(0, -keyDirection[1], -keyDirection[2]);
        const yzNormal = normalize(0, yzSampleNormal[1], yzSampleNormal[2]);
        const yzRefracted = refractVector(yzIncident, yzNormal, 1 / p.ior) || [0, yzIncident[1] * 0.45, -0.62];
        const yzRefractGroundT = yzSampleField.z / Math.max(0.08, -yzRefracted[2]);
        const yzRefractVisibleT = Math.max(8, yzRefractGroundT * 0.62);
        const yzRefractEndX = mapYSection(yzSampleY + yzRefracted[1] * yzRefractVisibleT);
        const yzRefractEndY = mapYZ(yzSampleField.z + yzRefracted[2] * yzRefractVisibleT);
        const yzTransmitEndX = mapYSection(clamp(yzSampleY + yzRefracted[1] * yzRefractGroundT, -h * 0.2, h * 1.2));

        const samples = [];
        for (let x = 0; x <= w; x += 2) {
          const hf = heightField(x, sliceY, p);
          samples.push({
            x,
            z: hf.inside ? hf.z : 0,
            face: hf.face,
            upperBevel: hf.upperBevel,
            lowerBevel: hf.lowerBevel,
            cavity: hf.cavity
          });
        }

        const topPath = samples
          .map((sample, index) => `${index === 0 ? "M" : "L"} ${mapX(sample.x).toFixed(2)} ${mapZ(sample.z).toFixed(2)}`)
          .join(" ");
        const materialPath = `${topPath} L ${mapX(w).toFixed(2)} ${baseline.toFixed(2)} L ${mapX(0).toFixed(2)} ${baseline.toFixed(2)} Z`;

        const faceLeft = p.faceInset;
        const faceRight = w - p.faceInset;
        const faceTop = mapZ(heightField(w * 0.5, sliceY, p).z);
        const bevelLeftX = mapX(faceLeft);
        const bevelRightX = mapX(faceRight);
        const sampleX = w - p.faceInset - p.bevelWidth * 0.48;
        const sampleField = heightField(sampleX, sliceY, p);
        const sampleNormal = normalAt(sampleX, sliceY, p);
        const hitX = mapX(sampleX);
        const hitY = mapZ(sampleField.z);
        const incidentStartX = hitX + keyDirection[0] * 118;
        const incidentStartY = hitY - keyDirection[2] * 118;
        const incident = normalize(-keyDirection[0], 0, -keyDirection[2]);
        const sectionNormal = normalize(sampleNormal[0], 0, sampleNormal[2]);
        const refracted = refractVector(incident, sectionNormal, 1 / p.ior) || [incident[0] * 0.45, 0, -0.62];
        const refractGroundT = sampleField.z / Math.max(0.08, -refracted[2]);
        const transmittedEndX = mapX(clamp(sampleX + refracted[0] * refractGroundT, -w * 0.2, w * 1.2));
        const shadowStartX = transmittedEndX;
        const shadowEndX = projectedGroundX(sampleX);
        const incidentLabelAtRight = incidentStartX > svgW - marginX - 130;
        const incidentLabelX = clamp(incidentStartX + (incidentLabelAtRight ? -8 : 8), marginX + 10, svgW - marginX - 10);
        const incidentLabelAnchor = incidentLabelAtRight ? "end" : "start";
        const projectedLabelAtRight = transmittedEndX > svgW - marginX - 180;
        const projectedLabelX = clamp(transmittedEndX + (projectedLabelAtRight ? -8 : 8), marginX + 10, svgW - marginX - 10);
        const projectedLabelAnchor = projectedLabelAtRight ? "end" : "start";
        const shadowLabelAtRight = shadowEndX > svgW - marginX - 150;
        const shadowLabelX = clamp(shadowEndX + (shadowLabelAtRight ? -8 : 8), marginX + 10, svgW - marginX - 10);
        const shadowLabelAnchor = shadowLabelAtRight ? "end" : "start";

        // ─── Multi-bounce internal ray trace (XZ section) ────────────────────────
        // Convention: all direction vectors are [x, 0, z] unit vectors in material space.
        // mapX / mapZ convert material coords to SVG pixels.
        // svgDir() converts a material-space unit direction to an SVG-space displacement
        // vector and returns it pre-scaled to `pxLen` pixels so rays never leave the viewport.
        const pxPerMatX = plotW / w;
        const pxPerMatZ = zGain; // mapZ(z) = baseline - z*zGain  → ΔsvgY = -Δz*zGain
        const svgDir = (d, pxLen = 60) => {
          const dx = d[0] * pxPerMatX;
          const dy = -d[2] * pxPerMatZ;
          const len = Math.hypot(dx, dy) || 1;
          return [dx / len * pxLen, dy / len * pxLen];
        };

        // Helper: march a ray [startX_mat, z=startZ_mat] in direction dir (XZ unit vector)
        // until it exits through the top profile. Returns { x, z, n } or null.
        const marchToProfile = (startX, startZ, dir) => {
          const dt = 0.4;
          for (let t = dt; t <= 1800; t += dt) {
            const tx = startX + dir[0] * t;
            const tz = startZ + dir[2] * t;
            if (tx < -8 || tx > w + 8 || tz < 0) return null;
            const ix = clamp(Math.round(tx), 0, w - 1);
            if (tz >= heightField(ix, sliceY, p).z) {
              return { x: tx, z: heightField(ix, sliceY, p).z, n: normalAt(ix, sliceY, p) };
            }
          }
          return null;
        };

        // Bounce 1 – entry refraction (already computed, just derive bottom-hit x):
        const b1_mat_x = sampleX + refracted[0] * refractGroundT;
        const b1_F = p.F0 + (1 - p.F0) * Math.pow(1 - Math.abs(refracted[2]), 5);
        const b1FStr = `${(b1_F * 100).toFixed(0)}%`;
        const svgB1x = mapX(clamp(b1_mat_x, -w * 0.2, w * 1.2));

        // Bounce 2 – internal reflection at bottom (flat, normal=[0,0,1]):
        const b2_dir = [refracted[0], 0, -refracted[2]]; // z flipped → going up
        const b2_hit = marchToProfile(b1_mat_x, 0, b2_dir);

        // Bounce 3 – ray from b2_hit back toward bottom or exits up:
        let b2_exit_ray = null, b2_tir = false, b3_dir = null;
        if (b2_hit) {
          const b2N = normalize(b2_hit.n[0], 0, b2_hit.n[2]);
          b2_exit_ray = refractVector(b2_dir, [-b2N[0], 0, -b2N[2]], p.ior); // glass→air
          b2_tir = b2_exit_ray === null;
          if (b2_tir) {
            const ddn = dot(b2_dir, b2N);
            b3_dir = normalize(b2_dir[0] - 2*ddn*b2N[0], 0, b2_dir[2] - 2*ddn*b2N[2]);
          }
        }

        // Bounce 3 → bottom (only if TIR):
        let b3_mat_x = null, b3_exit_ray = null;
        if (b3_dir && b3_dir[2] < -0.001 && b2_hit) {
          const t3 = b2_hit.z / Math.max(0.001, -b3_dir[2]);
          b3_mat_x = b2_hit.x + b3_dir[0] * t3;
          // Fresnel at this second bottom hit; then exit glass→air (inward normal = [0,0,1]):
          b3_exit_ray = refractVector(b3_dir, [0, 0, 1], p.ior);
        }

        // Bounce 4 – if b3 still TIRs at the bottom (very rare), march back up once more:
        let b4_dir = null, b4_hit = null, b4_exit_ray = null;
        if (!b3_exit_ray && b3_dir && b3_mat_x !== null) {
          b4_dir = [b3_dir[0], 0, -b3_dir[2]]; // reflect z at bottom
          b4_hit = marchToProfile(b3_mat_x, 0, b4_dir);
          if (b4_hit) {
            const b4N = normalize(b4_hit.n[0], 0, b4_hit.n[2]);
            b4_exit_ray = refractVector(b4_dir, [-b4N[0], 0, -b4N[2]], p.ior);
          }
        }

        // ── SVG coordinates (all exit rays use svgDir for fixed pixel length) ──
        const svgB2x = b2_hit ? mapX(clamp(b2_hit.x, -w*0.2, w*1.2)) : null;
        const svgB2y = b2_hit ? mapZ(b2_hit.z) : null;
        const [b2ex_dx, b2ex_dy] = b2_exit_ray ? svgDir(b2_exit_ray, 62) : [0, 0];
        const svgB2exitX = (b2_exit_ray && svgB2x !== null) ? svgB2x + b2ex_dx : null;
        const svgB2exitY = (b2_exit_ray && svgB2y !== null) ? svgB2y + b2ex_dy : null;

        const svgB3x = b3_mat_x !== null ? mapX(clamp(b3_mat_x, -w*0.2, w*1.2)) : null;
        const [b3ex_dx, b3ex_dy] = b3_exit_ray ? svgDir(b3_exit_ray, 56) : [0, 0];
        const svgB3exitX = (b3_exit_ray && svgB3x !== null) ? svgB3x + b3ex_dx : null;
        const svgB3exitY = b3_exit_ray ? baseline + b3ex_dy : null;

        const svgB4x = b4_hit ? mapX(clamp(b4_hit.x, -w*0.2, w*1.2)) : null;
        const svgB4y = b4_hit ? mapZ(b4_hit.z) : null;
        const [b4ex_dx, b4ex_dy] = b4_exit_ray ? svgDir(b4_exit_ray, 56) : [0, 0];
        const svgB4exitX = (b4_exit_ray && svgB4x !== null) ? svgB4x + b4ex_dx : null;
        const svgB4exitY = (b4_exit_ray && svgB4y !== null) ? svgB4y + b4ex_dy : null;

        // Annotation midpoints:
        const svgB2midX = b2_hit ? (svgB1x + svgB2x) / 2 : svgB1x;
        const svgB2midY = b2_hit ? (baseline + svgB2y) / 2 : baseline - 30;

        const refractMidX = (hitX + svgB1x) / 2;
        const refractMidY = (hitY + baseline) / 2;
        const [cyanStubDx, cyanStubDy] = svgDir(refracted, 34);
        const cyanStubX = svgB1x + cyanStubDx;
        const cyanStubY = baseline + cyanStubDy;
        const refractLabelAtRight = refractMidX > svgW - marginX - 150;
        const refractLabelX = clamp(refractMidX + (refractLabelAtRight ? -8 : 8), marginX + 10, svgW - marginX - 10);
        const refractLabelAnchor = refractLabelAtRight ? "end" : "start";
        // ─────────────────────────────────────────────────────────────────────────

        const diagramOuterStroke = rgbaString(getRigs().shell.outerColor, 1);
        const diagramInnerStroke = rgbaString(getRigs().shell.innerColor, 1);

        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("class", "cross-section-svg");
        svg.setAttribute("viewBox", `0 0 ${svgW} ${svgH}`);
        svg.setAttribute("preserveAspectRatio", "xMidYMin meet");
        svg.setAttribute("aria-hidden", "true");
        svg.innerHTML = `
          <defs>
            <marker id="arrow-white" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 9 4.5 L 0 9 z" fill="rgba(255,255,255,0.82)"></path>
            </marker>
            <marker id="arrow-cyan" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 9 4.5 L 0 9 z" fill="rgba(94,211,255,0.85)"></path>
            </marker>
            <marker id="arrow-violet" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 9 4.5 L 0 9 z" fill="rgba(179,142,255,0.85)"></path>
            </marker>
            <marker id="arrow-amber" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 9 4.5 L 0 9 z" fill="rgba(255,185,55,0.90)"></path>
            </marker>
            <linearGradient id="xz-material" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="rgba(235,246,255,0.62)"></stop>
              <stop offset="0.24" stop-color="rgba(86,103,130,0.42)"></stop>
              <stop offset="0.55" stop-color="rgba(7,8,14,0.82)"></stop>
              <stop offset="1" stop-color="rgba(0,0,3,0.96)"></stop>
            </linearGradient>
            <linearGradient id="xz-face" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="rgba(68,185,255,0.28)"></stop>
              <stop offset="0.5" stop-color="rgba(255,255,255,0.22)"></stop>
              <stop offset="1" stop-color="rgba(142,99,255,0.28)"></stop>
            </linearGradient>
            <filter id="xz-soft">
              <feGaussianBlur stdDeviation="1.2"></feGaussianBlur>
            </filter>
            <filter id="preview-shadow">
              <feGaussianBlur stdDeviation="11"></feGaussianBlur>
            </filter>
          </defs>

	          <rect x="0" y="0" width="${svgW}" height="${svgH}" fill="rgba(255,255,255,0.015)"></rect>

	          <text x="${xy.x}" y="32" fill="rgba(255,255,255,0.76)" font-size="13">X-Y top view</text>
	          <rect x="${xy.x}" y="${xy.y}" width="${xy.w}" height="${xy.h}" rx="10" fill="rgba(255,255,255,0.018)" stroke="rgba(255,255,255,0.08)"></rect>
	          <rect x="${xyX + xyShadowEndX - xyHitX}" y="${xyY + xyShadowEndY - xyHitY}" width="${xyW}" height="${xyH}" rx="${xyH / 2}" fill="rgba(0,0,0,0.2)" filter="url(#xz-soft)"></rect>
	          <rect x="${xyX}" y="${xyY}" width="${xyW}" height="${xyH}" rx="${xyH / 2}" fill="rgba(12,16,28,0.54)" stroke="${diagramOuterStroke}" stroke-opacity="${getRigs().shell.outerTransparency}" stroke-width="1.4"></rect>
	          <rect x="${xyX + p.faceInset * xyScale}" y="${xyY + p.faceInset * xyScale}" width="${(w - p.faceInset * 2) * xyScale}" height="${(h - p.faceInset * 2) * xyScale}" rx="${(h * 0.5 - p.faceInset) * xyScale}" fill="rgba(4,6,12,0.42)" stroke="${diagramInnerStroke}" stroke-opacity="${getRigs().shell.innerTransparency}" stroke-width="1"></rect>
	          <line x1="${xyLightStartX}" y1="${xyLightStartY}" x2="${xyHitX}" y2="${xyHitY}" stroke="rgba(255,255,255,0.8)" stroke-width="1.8" marker-end="url(#arrow-white)"></line>
	          <line x1="${xyHitX}" y1="${xyHitY}" x2="${xyShadowEndX}" y2="${xyShadowEndY}" stroke="rgba(179,142,255,0.72)" stroke-width="1.8" stroke-dasharray="6 5" marker-end="url(#arrow-violet)"></line>
	          <text x="${xy.x + 18}" y="${xy.y + xy.h - 18}" fill="rgba(255,255,255,0.48)" font-size="11">X-Y footprint, inner face boundary, light direction</text>
	          <text x="${xyX + xyW + 10}" y="${xyY + xyH + 4}" fill="rgba(255,255,255,0.7)" font-size="12">X</text>
	          <text x="${xyX - 10}" y="${xyY - 8}" fill="rgba(255,255,255,0.7)" font-size="12" text-anchor="end">Y</text>

	          <text x="${yz.x}" y="32" fill="rgba(255,255,255,0.76)" font-size="13">Y-Z tangent section and light path</text>
	          <rect x="${yz.x}" y="${yz.y}" width="${yz.w}" height="${yz.h}" rx="10" fill="rgba(255,255,255,0.018)" stroke="rgba(255,255,255,0.08)"></rect>
	          <line x1="${mapYSection(0)}" y1="${yz.base}" x2="${mapYSection(h)}" y2="${yz.base}" stroke="rgba(255,255,255,0.2)" stroke-width="1"></line>
	          <line x1="${mapYSection(0)}" y1="${yz.base}" x2="${mapYSection(0)}" y2="${yz.y + 24}" stroke="rgba(255,255,255,0.16)" stroke-width="1"></line>
	          <path d="${yzMaterialPath}" fill="url(#xz-material)" stroke="rgba(216,238,255,0.22)" stroke-width="1"></path>
	          <path d="${yzTopPath}" fill="none" stroke="rgba(255,255,255,0.82)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
	          <path d="${yzTopPath}" fill="none" stroke="rgba(112,188,255,0.28)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" filter="url(#xz-soft)"></path>
	          <line x1="${yzFaceUpper}" y1="${yzFaceTop}" x2="${yzFaceLower}" y2="${yzFaceTop}" stroke="url(#xz-face)" stroke-width="3.4" stroke-linecap="round"></line>
	          <line x1="${yzIncidentStartX}" y1="${yzIncidentStartY}" x2="${yzHitX}" y2="${yzHitY}" stroke="rgba(255,255,255,0.78)" stroke-width="1.8" marker-end="url(#arrow-white)"></line>
	          <line x1="${yzHitX}" y1="${yzHitY}" x2="${yzRefractEndX}" y2="${yzRefractEndY}" stroke="rgba(94,211,255,0.82)" stroke-width="1.8" marker-end="url(#arrow-cyan)"></line>
	          <line x1="${yzRefractEndX}" y1="${yzRefractEndY}" x2="${yzTransmitEndX}" y2="${yz.base}" stroke="rgba(94,211,255,0.48)" stroke-width="1.6" stroke-dasharray="6 5" marker-end="url(#arrow-cyan)"></line>
	          <text x="${yz.x + 16}" y="${yz.y + yz.h - 16}" fill="rgba(255,255,255,0.48)" font-size="11">screen-space vertical section, sampled at x = w / 2</text>
	          <text x="${mapYSection(h) + 9}" y="${yz.base + 4}" fill="rgba(255,255,255,0.7)" font-size="12">Y</text>
	          <text x="${mapYSection(0) - 8}" y="${yz.y + 28}" fill="rgba(255,255,255,0.7)" font-size="12" text-anchor="end">Z</text>

	          <text x="${marginX}" y="350" fill="rgba(255,255,255,0.76)" font-size="13">X-Z tangent section and light path</text>
	          <text x="${marginX}" y="366" fill="rgba(255,255,255,0.42)" font-size="10">Amber = bounces inside solid; arrows only on exit to air. Bake shader ≈ single internal bounce.</text>
	          <line x1="${marginX}" y1="${baseline}" x2="${svgW - marginX}" y2="${baseline}" stroke="rgba(255,255,255,0.22)" stroke-width="1"></line>
	          <line x1="${marginX}" y1="${pagePlaneY}" x2="${svgW - marginX}" y2="${pagePlaneY}" stroke="rgba(179,142,255,0.2)" stroke-width="1" stroke-dasharray="7 7"></line>
	          <line x1="${marginX}" y1="${baseline}" x2="${marginX}" y2="380" stroke="rgba(255,255,255,0.18)" stroke-width="1"></line>
          <path d="${materialPath}" fill="url(#xz-material)" stroke="rgba(216,238,255,0.22)" stroke-width="1"></path>
          <path d="${topPath}" fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="${topPath}" fill="none" stroke="rgba(112,188,255,0.38)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" filter="url(#xz-soft)"></path>

          <line x1="${incidentStartX}" y1="${incidentStartY}" x2="${hitX}" y2="${hitY}" stroke="rgba(255,255,255,0.82)" stroke-width="2" marker-end="url(#arrow-white)"></line>
          <line x1="${hitX}" y1="${hitY}" x2="${svgB1x}" y2="${baseline}" stroke="rgba(94,211,255,0.88)" stroke-width="2" marker-end="url(#arrow-cyan)"></line>
          <line x1="${svgB1x}" y1="${baseline}" x2="${cyanStubX}" y2="${cyanStubY}" stroke="rgba(94,211,255,0.5)" stroke-width="1.8" stroke-dasharray="6 5" marker-end="url(#arrow-cyan)"></line>
          <line x1="${shadowStartX}" y1="${baseline}" x2="${shadowEndX}" y2="${pagePlaneY}" stroke="rgba(179,142,255,0.72)" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#arrow-violet)"></line>
          <ellipse cx="${shadowEndX}" cy="${pagePlaneY + 9}" rx="${p.surfaceLift * 2.2 + 36}" ry="${12 + getRigs().material.surfaceLift * 12}" fill="rgba(0,0,0,0.24)" filter="url(#xz-soft)"></ellipse>

          <!-- ── Multi-bounce internal ray trace (amber = inside glass) ── -->
          <!-- B1 bottom-hit marker + Fresnel label -->
          <circle cx="${svgB1x}" cy="${baseline}" r="4" fill="rgba(255,185,55,0.88)"></circle>
          <text x="${svgB1x + 6}" y="${baseline - 7}"
                fill="rgba(255,185,55,0.78)" font-size="10">R≈${b1FStr} Fresnel</text>

          <!-- B1→B2: internal reflection ray traveling upward inside glass -->
          ${b2_hit ? `
          <line x1="${svgB1x}" y1="${baseline}" x2="${svgB2x}" y2="${svgB2y}"
                stroke="rgba(255,185,55,0.86)" stroke-width="2.2"
                stroke-linecap="round"></line>
          <circle cx="${svgB1x}" cy="${baseline}" r="5" fill="none" stroke="rgba(255,185,55,0.55)" stroke-width="1.2"></circle>
          <circle cx="${svgB2x}" cy="${svgB2y}" r="3.5"
                  fill="${b2_tir ? "rgba(255,100,30,0.90)" : "rgba(255,220,90,0.88)"}"></circle>
          <text x="${svgB2midX - 5}" y="${svgB2midY}"
                fill="rgba(255,185,55,0.70)" font-size="10" text-anchor="end">internal refl.</text>
          ` : ""}

          <!-- B2 exit (not TIR): short ray leaving the top surface -->
          ${(b2_exit_ray && svgB2exitX !== null) ? `
          <line x1="${svgB2x}" y1="${svgB2y}" x2="${svgB2exitX}" y2="${svgB2exitY}"
                stroke="rgba(255,220,80,0.68)" stroke-width="1.8" stroke-dasharray="5 4"
                marker-end="url(#arrow-amber)"></line>
          <text x="${svgB2x + 6}" y="${svgB2y - 7}"
                fill="rgba(255,220,80,0.82)" font-size="10">exit n=${p.ior.toFixed(2)}→1</text>
          ` : ""}

          <!-- B2 TIR: label + continue downward (Bounce 2→3) -->
          ${b2_tir ? `
          <text x="${svgB2x + 6}" y="${svgB2y - 7}"
                fill="rgba(255,100,30,0.88)" font-size="10">TIR (θ&gt;θ꜀)</text>
          ` : ""}
          ${(b2_tir && b3_dir && svgB3x !== null) ? `
          <line x1="${svgB2x}" y1="${svgB2y}" x2="${svgB3x}" y2="${baseline}"
                stroke="rgba(255,150,45,0.82)" stroke-width="2.2"
                stroke-linecap="round"></line>
          <circle cx="${svgB3x}" cy="${baseline}" r="4" fill="rgba(255,150,45,0.86)"></circle>
          ` : ""}

          <!-- B3 bottom: exit through bottom, or bounce again -->
          ${(svgB3x !== null && svgB3exitX !== null) ? `
          <line x1="${svgB3x}" y1="${baseline}" x2="${svgB3exitX}" y2="${svgB3exitY}"
                stroke="rgba(255,210,70,0.62)" stroke-width="1.8" stroke-dasharray="5 4"
                marker-end="url(#arrow-amber)"></line>
          <text x="${svgB3x + 5}" y="${baseline - 7}"
                fill="rgba(255,210,70,0.74)" font-size="10">delayed trans.</text>
          ` : ""}

          <!-- B4: Bounce 3→4 (2nd TIR + top-surface hit → exit) -->
          ${(svgB4x !== null && svgB3x !== null) ? `
          <line x1="${svgB3x}" y1="${baseline}" x2="${svgB4x}" y2="${svgB4y}"
                stroke="rgba(255,165,40,0.76)" stroke-width="2"
                stroke-linecap="round"></line>
          <circle cx="${svgB4x}" cy="${svgB4y}" r="3"
                  fill="${b4_exit_ray ? "rgba(255,220,90,0.85)" : "rgba(255,80,20,0.88)"}"></circle>
          ` : ""}
          ${(svgB4exitX !== null) ? `
          <line x1="${svgB4x}" y1="${svgB4y}" x2="${svgB4exitX}" y2="${svgB4exitY}"
                stroke="rgba(255,220,80,0.52)" stroke-width="1.6" stroke-dasharray="5 4"
                marker-end="url(#arrow-amber)"></line>
          <text x="${svgB4x + 5}" y="${svgB4y - 7}"
                fill="rgba(255,210,70,0.68)" font-size="10">exit ×4</text>
          ` : ""}
          <!-- ─────────────────────────────────────────────────────────────── -->

          <line x1="${bevelLeftX}" y1="${baseline}" x2="${bevelLeftX}" y2="${faceTop - 10}" stroke="rgba(99,198,255,0.5)" stroke-width="1" stroke-dasharray="5 5"></line>
          <line x1="${bevelRightX}" y1="${baseline}" x2="${bevelRightX}" y2="${faceTop - 10}" stroke="rgba(170,132,255,0.5)" stroke-width="1" stroke-dasharray="5 5"></line>
          <line x1="${bevelLeftX}" y1="${faceTop}" x2="${bevelRightX}" y2="${faceTop}" stroke="url(#xz-face)" stroke-width="4" stroke-linecap="round"></line>

          <text x="${incidentLabelX}" y="${incidentStartY - 5}" fill="rgba(255,255,255,0.72)" font-size="11" text-anchor="${incidentLabelAnchor}">incident light</text>
          <text x="${refractLabelX}" y="${refractMidY - 6}" fill="rgba(94,211,255,0.8)" font-size="11" text-anchor="${refractLabelAnchor}">refracted ray, IOR ${p.ior.toFixed(2)}</text>
          <text x="${projectedLabelX}" y="${baseline - 8}" fill="rgba(94,211,255,0.72)" font-size="11" text-anchor="${projectedLabelAnchor}">transmitted projection</text>
          <text x="${shadowLabelX}" y="${pagePlaneY - 8}" fill="rgba(179,142,255,0.76)" font-size="11" text-anchor="${shadowLabelAnchor}">cast shadow, lift ${(p.surfaceLift / h).toFixed(2)}</text>
          <text x="${marginX - 8}" y="384" fill="rgba(255,255,255,0.7)" font-size="12" text-anchor="end">Z</text>
          <text x="${svgW - marginX + 10}" y="${baseline + 4}" fill="rgba(255,255,255,0.7)" font-size="12">X</text>
          <text x="${(bevelLeftX + bevelRightX) / 2}" y="${faceTop - 16}" fill="rgba(255,255,255,0.72)" font-size="12" text-anchor="middle">flat central face: h = ${getRigs().buttonSpec.topHeight.toFixed(1)}</text>
          <text x="${(marginX + bevelLeftX) / 2}" y="${baseline - 20}" fill="rgba(99,198,255,0.62)" font-size="12" text-anchor="middle">left cap / bevel shell</text>
          <text x="${(bevelRightX + svgW - marginX) / 2}" y="${baseline - 20}" fill="rgba(170,132,255,0.62)" font-size="12" text-anchor="middle">right cap / bevel shell</text>
          <text x="${marginX + 14}" y="${mapZ(p.zProfile.sideHeight) - 8}" fill="rgba(255,255,255,0.52)" font-size="11">edge shoulder: h = ${getRigs().buttonSpec.edgeHeight.toFixed(1)}</text>
          <text x="${svgW - marginX - 14}" y="${mapZ(p.zProfile.sideHeight) - 8}" fill="rgba(255,255,255,0.52)" font-size="11" text-anchor="end">r = ${Math.round(getRigs().buttonSpec.zRadius)} circular blend</text>
          <text x="${marginX}" y="${baseline + 20}" fill="rgba(255,255,255,0.48)" font-size="11">button base plane</text>
          <text x="${marginX}" y="${pagePlaneY + 22}" fill="rgba(179,142,255,0.52)" font-size="11">page plane / shadow receiver</text>
        `;

        host.replaceChildren(svg);
      }

      function renderStage(stage, timeMs = performance.now(), attempt = 0) {
        stage.innerHTML = `
          <button class="optical-capsule" type="button"><span></span></button>
        `;

        const button = stage.querySelector(".optical-capsule");
        const label = button.querySelector("span");
        if (label) label.textContent = getRigs().label.text.trim() || defaultLabelText;

        const rect = button.getBoundingClientRect();
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);

        if ((w < 2 || h < 2) && attempt < 5) {
          requestAnimationFrame(() => renderStage(stage, timeMs, attempt + 1));
          return;
        }
        if (w < 2 || h < 2) return;

        if (label) applyLabelStyles(label, h);

        applyShellStyles(button, h);
        makeUnderlay(stage, w, h, rect, timeMs);
        makeSVG(button, w, h, rect, timeMs);
      }

function relativeLuminance(color) {
        const channel = v => {
          const c = clamp(v, 0, 1);
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        return channel(color[0]) * 0.2126 + channel(color[1]) * 0.7152 + channel(color[2]) * 0.0722;
      }

      function mixColor(a, b, t) {
        return [
          a[0] * (1 - t) + b[0] * t,
          a[1] * (1 - t) + b[1] * t,
          a[2] * (1 - t) + b[2] * t
        ];
      }

      function rgbaString(color, alpha) {
        return `rgba(${Math.round(clamp(color[0], 0, 1) * 255)}, ${Math.round(clamp(color[1], 0, 1) * 255)}, ${Math.round(clamp(color[2], 0, 1) * 255)}, ${alpha})`;
      }

      function shellStrokeWidth(h, scale, baseRatio, maxWidth) {
        return clamp(h * baseRatio * scale, 0, maxWidth);
      }

      function applyLabelStyles(label, h) {
        const heightScale = clamp(h / 112, 0.35, 1.6);
        label.style.color = rgbaString(getRigs().label.color, getRigs().label.transparency);
        label.style.textShadow = [
          `0 ${(getRigs().label.shadowDarkOffsetY * heightScale).toFixed(2)}px ${(getRigs().label.shadowDarkBlur * heightScale).toFixed(2)}px ${rgbaString(getRigs().label.shadowDarkColor, getRigs().label.shadowDarkOpacity)}`,
          `0 0 ${(getRigs().label.shadowLightBlur * heightScale).toFixed(2)}px ${rgbaString(getRigs().label.shadowLightColor, getRigs().label.shadowLightOpacity)}`
        ].join(", ");
      }

      function applyLabelTextToAll() {
        const text = getRigs().label.text.trim() || defaultLabelText;
        document.querySelectorAll(".optical-capsule span").forEach(label => {
          label.textContent = text;
        });
      }

      function applyLabelStylesToAll() {
        document.querySelectorAll(".optical-capsule").forEach(button => {
          const label = button.querySelector("span");
          if (label) applyLabelStyles(label, button.offsetHeight);
        });
      }

      function applyShellStyles(button, h) {
        const seeThrough = getRigs().background.mode === "image";
        const outerWidth = shellStrokeWidth(h, getRigs().shell.outerWidthScale, 0.012, 3);
        button.style.border =
          outerWidth > 0 && getRigs().shell.outerTransparency > 0
            ? `${outerWidth}px solid ${rgbaString(getRigs().shell.outerColor, getRigs().shell.outerTransparency)}`
            : "none";

        const ringWidth = clamp(getRigs().shell.insetRingWidth, 0, 12);
        const insetRing =
          ringWidth > 0 && getRigs().shell.insetRingTransparency > 0
            ? `inset 0 0 0 ${ringWidth}px ${rgbaString(getRigs().shell.insetRingColor, getRigs().shell.insetRingTransparency)}`
            : null;

        button.style.boxShadow = seeThrough
          ? [
              "inset 0 1px 0 rgba(255, 255, 255, 0.72)",
              "inset 0 -1px 0 rgba(255, 255, 255, 0.28)",
              "inset 0 -8px 12px rgba(0, 0, 0, 0.1)",
              "inset 0 -2px 4px rgba(70, 116, 255, 0.28)",
              insetRing,
              "inset 8px 0 12px rgba(72, 190, 255, 0.1)",
              "inset -9px 0 14px rgba(126, 82, 255, 0.11)"
            ].filter(Boolean).join(", ")
          : [
              "inset 0 1px 0 rgba(255, 255, 255, 0.9)",
              "inset 0 -1px 0 rgba(255, 255, 255, 0.42)",
              "inset 0 -14px 18px rgba(0, 0, 0, 0.32)",
              "inset 0 -3px 5px rgba(70, 116, 255, 0.62)",
              insetRing,
              "inset 11px 0 16px rgba(72, 190, 255, 0.17)",
              "inset -12px 0 18px rgba(126, 82, 255, 0.18)"
            ].filter(Boolean).join(", ");
        button.classList.toggle("optical-capsule--displace-backdrop", !!getRigs().material.backdropDisplaceTry);
      }

      function updateBackdropDisplacementFilterScale() {
        const mapEl = document.querySelector("#oc-backdrop-displace feDisplacementMap");
        if (!mapEl) return;
        const s = clamp((getRigs().material.ior - 1) * 18 + 4, 4, 34);
        mapEl.setAttribute("scale", String(s));
      }

      function applyHeroContrast() {
        const environment = getRigs().background.mode === "solid"
          ? getRigs().background.base
          : mixColor(getRigs().background.base, getRigs().background.accent, clamp(getRigs().background.opacity, 0, 0.8) * 0.55);
        const lum = relativeLuminance(environment);
        const useDarkText = lum > 0.48;

        document.documentElement.style.setProperty("--hero-text", useDarkText ? "rgba(4, 6, 10, 0.94)" : "rgba(255, 255, 255, 0.96)");
        document.documentElement.style.setProperty("--hero-muted", useDarkText ? "rgba(4, 6, 10, 0.68)" : "rgba(255, 255, 255, 0.68)");
        document.documentElement.style.setProperty("--hero-shadow", useDarkText ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.48)");
      }

      function readPxVar(element, name) {
        const raw = getComputedStyle(element).getPropertyValue(name).trim();
        return Number(raw.replace("px", ""));
      }

      function applyButtonSpec() {
        document.querySelectorAll(".capsule-stage").forEach(stage => {
          if (!stage.dataset.baseW) {
            stage.dataset.baseW = String(readPxVar(stage, "--w"));
            stage.dataset.baseH = String(readPxVar(stage, "--h"));
            stage.dataset.baseFs = String(readPxVar(stage, "--fs"));
            stage.dataset.baseDrop = String(readPxVar(stage, "--drop"));
          }

          const baseW = Number(stage.dataset.baseW);
          const baseH = Number(stage.dataset.baseH);
          const baseFs = Number(stage.dataset.baseFs);
          const baseDrop = Number(stage.dataset.baseDrop);
          const width = baseW * getRigs().buttonSpec.widthScale;
          const height = baseH * getRigs().buttonSpec.heightScale;
          const fontScale = Math.sqrt(getRigs().buttonSpec.widthScale * getRigs().buttonSpec.heightScale);

          stage.style.setProperty("--w", `${width.toFixed(2)}px`);
          stage.style.setProperty("--h", `${height.toFixed(2)}px`);
          stage.style.setProperty("--fs", `${(baseFs * fontScale).toFixed(2)}px`);
          stage.style.setProperty("--drop", `${(baseDrop * getRigs().buttonSpec.heightScale).toFixed(2)}px`);
        });
      }

      function applyBackground() {
        document.body.dataset.bgMode = getRigs().background.mode;
        document.documentElement.style.setProperty("--bg-base", rgbToHex(getRigs().background.base));
        document.documentElement.style.setProperty("--bg-accent", rgbToHex(getRigs().background.accent));
        document.documentElement.style.setProperty("--bg-image", getRigs().background.imageUrl ? `url("${getRigs().background.imageUrl.replaceAll('"', "%22")}")` : "none");
        document.documentElement.style.setProperty("--bg-texture-opacity", getRigs().background.opacity.toFixed(2));
        document.documentElement.style.setProperty("--bg-texture-scale", `${Math.round(getRigs().background.scale)}px`);
        applyHeroContrast();
      }

  return {
    renderStage,
    renderCrossSection,
    applyButtonSpec,
    applyBackground,
    updateBackdropDisplacementFilterScale,
    applyHeroContrast,
    applyLabelStylesToAll,
    applyLabelTextToAll,
    applyShellStyles,
    prefersReducedMotion,
    capsuleSDF
  };
}
