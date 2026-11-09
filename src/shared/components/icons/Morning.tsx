import React from 'react';
import Svg, { Defs, Path, Mask, Use } from 'react-native-svg';

interface MorningIconProps {
  width?: number | string;
  height?: number | string;
}

export default function MorningIcon({
  width = 24,
  height = 24,
}: MorningIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 1024 1024" fill="none">
      <Defs>
        <Path
          id="stroke0_458_2196"
          d="M768 589C768 555.382 761.378 522.092 748.513 491.033C735.648 459.974 716.791 431.752 693.019 407.981C669.248 384.209 641.026 365.352 609.967 352.487C578.908 339.622 545.618 333 512 333C478.382 333 445.092 339.622 414.033 352.487C382.974 365.352 354.752 384.209 330.981 407.981C307.209 431.752 288.352 459.974 275.487 491.033C262.622 522.092 256 555.382 256 589Z"
        />
        <Mask id="stroke1_458_2196" fill="white">
          <Use href="#stroke0_458_2196" />
        </Mask>
      </Defs>

      {/* Sun Background Fill */}
      <Use href="#stroke0_458_2196" fill="#FAA419" />

      {/* Sun Outline */}
      <Path
        d="M768 589C768 555.382 761.378 522.092 748.513 491.033C735.648 459.974 716.791 431.752 693.019 407.981C669.248 384.209 641.026 365.352 609.967 352.487C578.908 339.622 545.618 333 512 333C478.382 333 445.092 339.622 414.033 352.487C382.974 365.352 354.752 384.209 330.981 407.981C307.209 431.752 288.352 459.974 275.487 491.033C262.622 522.092 256 555.382 256 589Z"
        strokeWidth={48}
        stroke="black"
        strokeLinejoin="round"
        strokeLinecap="round"
        mask="url(#stroke1_458_2196)"
      />

      {/* Horizon & Rays */}
      <Path
        d="M165 578H859"
        strokeWidth={24}
        strokeLinecap="round"
        stroke="black"
      />
      <Path
        d="M747.879 251L678.998 342.464"
        strokeWidth={24}
        strokeLinecap="round"
        stroke="black"
      />
      <Path
        d="M879.652 428.312L772.168 467.777"
        strokeWidth={24}
        strokeLinecap="round"
        stroke="black"
      />
      <Path
        d="M511.652 179V293.5"
        strokeWidth={24}
        strokeLinecap="round"
        stroke="black"
      />
      <Path
        d="M275.771 248L344.652 339.464"
        strokeWidth={24}
        strokeLinecap="round"
        stroke="black"
      />
      <Path
        d="M144 425.312L251.484 464.777"
        strokeWidth={24}
        strokeLinecap="round"
        stroke="black"
      />

      {/* Sea / Reflection Lines */}
      <Path
        d="M162 622H860.5"
        strokeWidth={24}
        strokeLinecap="round"
        stroke="black"
      />
      <Path
        d="M220.5 668H799.5"
        strokeWidth={24}
        strokeLinecap="round"
        stroke="black"
      />
      <Path
        d="M288 714H732.5"
        strokeWidth={24}
        strokeLinecap="round"
        stroke="black"
      />
      <Path
        d="M353.5 760H668.5"
        strokeWidth={24}
        strokeLinecap="round"
        stroke="black"
      />
      <Path
        d="M420 806H601"
        strokeWidth={24}
        strokeLinecap="round"
        stroke="black"
      />
    </Svg>
  );
}
