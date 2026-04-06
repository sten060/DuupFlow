"use client";

import * as React from "react";

interface LiquidGlassProps {
  borderRadius?: number;
  borderWidth?: number;
  brightness?: number;
  glassOpacity?: number;
  blur?: number;
  displace?: number;
  liquidBlur?: number;
  backgroundOpacity?: number;
  saturation?: number;
  distortionScale?: number;
  chromaAmount?: number;
  centerStability?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const defaultProps: Required<Omit<LiquidGlassProps, "style" | "children">> = {
  borderRadius: 100,
  borderWidth: 0.05,
  brightness: 100,
  glassOpacity: 0.29,
  blur: 4,
  displace: 0.8,
  liquidBlur: 1,
  backgroundOpacity: 0.04,
  saturation: 0.6,
  distortionScale: -160,
  chromaAmount: 0,
  centerStability: 0,
};

function useId(): string {
  const ref = React.useRef<string | null>(null);
  if (ref.current === null) {
    ref.current =
      "lg-" +
      Math.random().toString(36).substring(2, 9) +
      Date.now().toString(36);
  }
  return ref.current;
}

function isDarkMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function isChromiumBased(): boolean {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent;
  return /Chrome|Chromium|Edg/.test(ua) && !/Firefox|Safari\/(?!.*Chrome)/.test(ua);
}

function generateDisplacementSVG(
  width: number,
  height: number,
  distortionScale: number,
  liquidBlur: number,
  centerStability: number
): string {
  const cx = width / 2;
  const cy = height / 2;
  const maxDim = Math.max(width, height);

  // Generate turbulence-based displacement map as an inline SVG data URI
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <filter id="turbulence" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="${0.015 + liquidBlur * 0.005}"
            numOctaves="3"
            seed="1"
            stitchTiles="stitch"
            result="noise"
          />
          <feGaussianBlur
            in="noise"
            stdDeviation="${liquidBlur * 2}"
            result="blurredNoise"
          />
          <feColorMatrix
            in="blurredNoise"
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="coloredNoise"
          />
        </filter>
        ${
          centerStability > 0
            ? `<radialGradient id="stabilityMask" cx="${cx}" cy="${cy}" r="${maxDim * 0.5}" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="black" stop-opacity="${centerStability}" />
                <stop offset="100%" stop-color="black" stop-opacity="0" />
              </radialGradient>`
            : ""
        }
      </defs>
      <rect width="${width}" height="${height}" filter="url(#turbulence)" />
      ${
        centerStability > 0
          ? `<rect width="${width}" height="${height}" fill="url(#stabilityMask)" />`
          : ""
      }
    </svg>
  `;

  return `data:image/svg+xml;base64,${typeof btoa !== "undefined" ? btoa(svg) : Buffer.from(svg).toString("base64")}`;
}

function LiquidGlass(props: LiquidGlassProps) {
  const {
    borderRadius = defaultProps.borderRadius,
    borderWidth = defaultProps.borderWidth,
    brightness = defaultProps.brightness,
    glassOpacity = defaultProps.glassOpacity,
    blur = defaultProps.blur,
    displace = defaultProps.displace,
    liquidBlur = defaultProps.liquidBlur,
    backgroundOpacity = defaultProps.backgroundOpacity,
    saturation = defaultProps.saturation,
    distortionScale = defaultProps.distortionScale,
    chromaAmount = defaultProps.chromaAmount,
    centerStability = defaultProps.centerStability,
    style,
    children,
  } = props;

  const filterId = useId();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 200, height: 200 });
  const dark = React.useMemo(() => isDarkMode(), []);
  const chromium = React.useMemo(() => isChromiumBased(), []);

  // ResizeObserver to track container dimensions
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setSize({ width: Math.round(width), height: Math.round(height) });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const displacementImage = React.useMemo(
    () =>
      generateDisplacementSVG(
        size.width,
        size.height,
        distortionScale,
        liquidBlur,
        centerStability
      ),
    [size.width, size.height, distortionScale, liquidBlur, centerStability]
  );

  // Scale factor for displacement
  const displaceScale = displace * Math.abs(distortionScale);

  // Chromatic aberration offsets
  const chromaR = chromaAmount * 2;
  const chromaB = -chromaAmount * 2;

  // Background tint based on dark mode
  const bgTint = dark
    ? `rgba(255, 255, 255, ${backgroundOpacity})`
    : `rgba(0, 0, 0, ${backgroundOpacity})`;

  // Border color
  const borderColor = dark
    ? `rgba(255, 255, 255, ${borderWidth})`
    : `rgba(0, 0, 0, ${borderWidth})`;

  // Glass overlay color
  const glassOverlay = dark
    ? `rgba(60, 60, 60, ${glassOpacity})`
    : `rgba(255, 255, 255, ${glassOpacity})`;

  // Saturation value for the filter (1 = normal, 0 = desaturated, 2 = oversaturated)
  const saturationValue = 1 + saturation;

  // Build SVG filter
  const svgFilter = React.useMemo(() => {
    const filterPrimitives: string[] = [];

    // Step 1: Get the source graphic backdrop with blur
    filterPrimitives.push(
      `<feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="blurred" />`
    );

    // Step 2: Displacement map
    if (displace > 0) {
      filterPrimitives.push(
        `<feImage href="${displacementImage}" result="dispMap" x="0" y="0" width="${size.width}" height="${size.height}" />`
      );
      filterPrimitives.push(
        `<feDisplacementMap in="blurred" in2="dispMap" scale="${displaceScale}" xChannelSelector="R" yChannelSelector="G" result="displaced" />`
      );
    }

    const inputAfterDisplace = displace > 0 ? "displaced" : "blurred";

    // Step 3: Chromatic aberration
    if (chromaAmount > 0) {
      // Red channel offset
      filterPrimitives.push(
        `<feOffset in="${inputAfterDisplace}" dx="${chromaR}" dy="0" result="redShift" />`
      );
      // Blue channel offset
      filterPrimitives.push(
        `<feOffset in="${inputAfterDisplace}" dx="${chromaB}" dy="0" result="blueShift" />`
      );

      // Extract channels and recombine for chromatic aberration
      // Red from shifted red
      filterPrimitives.push(
        `<feColorMatrix in="redShift" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="redChannel" />`
      );
      // Green from original
      filterPrimitives.push(
        `<feColorMatrix in="${inputAfterDisplace}" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="greenChannel" />`
      );
      // Blue from shifted blue
      filterPrimitives.push(
        `<feColorMatrix in="blueShift" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blueChannel" />`
      );

      // Composite channels together
      filterPrimitives.push(
        `<feComposite in="redChannel" in2="greenChannel" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="rg" />`
      );
      filterPrimitives.push(
        `<feComposite in="rg" in2="blueChannel" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="chromatic" />`
      );
    }

    const inputAfterChroma =
      chromaAmount > 0 ? "chromatic" : inputAfterDisplace;

    // Step 4: Brightness
    if (brightness !== 100) {
      const brightnessVal = brightness / 100;
      filterPrimitives.push(
        `<feComponentTransfer in="${inputAfterChroma}" result="brightened">
          <feFuncR type="linear" slope="${brightnessVal}" />
          <feFuncG type="linear" slope="${brightnessVal}" />
          <feFuncB type="linear" slope="${brightnessVal}" />
        </feComponentTransfer>`
      );
    }

    const inputAfterBrightness =
      brightness !== 100 ? "brightened" : inputAfterChroma;

    // Step 5: Saturation
    filterPrimitives.push(
      `<feColorMatrix in="${inputAfterBrightness}" type="saturate" values="${saturationValue}" result="final" />`
    );

    return filterPrimitives.join("\n");
  }, [
    blur,
    displace,
    displacementImage,
    size.width,
    size.height,
    displaceScale,
    chromaAmount,
    chromaR,
    chromaB,
    brightness,
    saturationValue,
  ]);

  // For non-Chromium browsers, use CSS filter fallback
  const cssFilterFallback = !chromium
    ? {
        backdropFilter: `blur(${blur}px) brightness(${brightness / 100}) saturate(${saturationValue})`,
        WebkitBackdropFilter: `blur(${blur}px) brightness(${brightness / 100}) saturate(${saturationValue})`,
      }
    : {};

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius,
        width: "100%",
        height: "100%",
        ...style,
      }}
    >
      {/* SVG filter definitions */}
      <svg
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <defs>
          <filter
            id={filterId}
            x="0"
            y="0"
            width={size.width}
            height={size.height}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
            dangerouslySetInnerHTML={{ __html: svgFilter }}
          />
        </defs>
      </svg>

      {/* Backdrop layer with glass effect */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius,
          ...(chromium
            ? {
                backdropFilter: `url(#${filterId})`,
                WebkitBackdropFilter: `url(#${filterId})`,
              }
            : cssFilterFallback),
        }}
      />

      {/* Background tint overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius,
          backgroundColor: bgTint,
          pointerEvents: "none",
        }}
      />

      {/* Glass overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius,
          backgroundColor: glassOverlay,
          pointerEvents: "none",
        }}
      />

      {/* Border */}
      {borderWidth > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius,
            border: `1px solid ${borderColor}`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Content */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default LiquidGlass;
