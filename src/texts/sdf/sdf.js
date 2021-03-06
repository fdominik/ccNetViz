import GlyphAtlas from './atlas';
import SpriteGenerator from './spriteGenerator';

/**
 *  Copyright (c) 2016, Helikar Lab.
 *  All rights reserved.
 *
 *  This source code is licensed under the GPLv3 License.
 *  Authors: Aleš Saska
 */

// A simplified representation of the glyph containing only the properties needed for shaping.
class SimpleGlyph {
  constructor(glyph, rect, buffer, style) {
    const padding = 1;
    this.advance = glyph.advance;
    this.left = glyph.left - buffer - padding;
    this.top = glyph.top + buffer + padding;
    this.rect = rect;
  }
}

// Multiplication factor by which the size will grow
const SIZE_GROWTH_RATE = 4;

// Size in which we try to contian the glyphs
const DEFAULT_SIZE = 512;

// must be "DEFAULT_SIZE * SIZE_GROWTH_RATE ^ n" for some integer n
// Maybe the maximum size allowed of the atlas
const MAX_SIZE = 2048;

// Class for the text engine

// invoked only when main configuration object, the "font" is mentioned and
// the proper link to the font file is present
export default class {
  // new text engine object takes 3 arguments
  // 1. gl = Webgl context
  // 2. files = File object programmed in src/dataSources/files.js
  // 3. texture = Texture object programmed in src/dataSources/textures.js

  constructor(gl, files, textures) {
    // Defines the dimensions of the texture
    this.width = DEFAULT_SIZE;
    this.height = DEFAULT_SIZE;

    // Does nothing. Required in default.js text engine
    this.clear();

    // _files contains the file object of the glyph obtained via protobuf
    this._files = files;

    // Webgl Rendering context
    this._gl = gl;

    // Atlas object programmed in src/texts/sdf/atlas.js
    this.atlas = new GlyphAtlas(this._gl, () => {
      this._cachedGlyphs = {};
    });

    // For every char_id, contains position, properties and buffer data
    this._glyphs = {};

    // For every char_id, contains position and properties
    this._rects = {};

    // glyphs that are cached from previous draw call of label for next one
    this._cachedGlyphs = {};
  }

  // returns if we are using SDF TextEngine or not
  get isSDF() {
    return true;
  }

  // this is a dummy method to make 'interface' of sdf.js and default.js same
  clear() {}

  /**
   * style = object: {
   *   pbf: <url to the font file on the server>
   *   type: 'sdf' {Type of the font file & sdf => distance transformed spriteSheet}
   * }
   */
  setFont(style) {
    // curFont => current_font
    // style.pbf examplar value = http://helikarlab.github.io/ccNetViz/fonts/FineHand/0-65535.pbf
    this.fontStyle = style;
    this.curFont = JSON.stringify(style);
  }

  // FontSize is fixed and hardcoded i.e. 24
  get fontSize() {
    return 24;
  }

  getWidthAndHeight(text, fontStyle, markDirty) {
    let wordWidth = 0;
    let width = 0;
    let height = 0;
    let widthArray = [];
    const horiBearingX = 3;
    //replaces the multiple space characters in the text with a single space
    text = text.replace(/\s+/g, ' ');
    for (let i = 0; i < text.length; i++) {
      const char = this._getChar(text[i], fontStyle, markDirty);
      const rect = char.rect || {};

      // Initially in the "get" function , height is undefined so , height = 0 , now rect.h and char.top
      //decide the height and then max of them is taken each time to have a max height that fits each char

      height = Math.max(height, rect.h - char.top);
      wordWidth += text[i] === ' ' ? 0 : char.advance + horiBearingX;
      // highest word length would be selected as the width
      if (text[i] === ' ' || i == text.length - 1) {
        width = wordWidth > width ? wordWidth : width;
        widthArray.push(wordWidth);
        wordWidth = 0;
      }
    }
    return { width: width, height: height, widthArray: widthArray };
  }

  getTexture(fontStyle, onLoad) {
    // init with first most-used ASCII chars
    for (let i = 0; i < 128; i++) {
      // Cache the most used characters prior to the knowledge if they would be used in lables or not
      // TODO: Ideally get methods should return something which in-turn should pe passed to other variables
      this._getChar(String.fromCharCode(i), fontStyle);
    }
    onLoad && onLoad.apply(this, arguments);

    // by calling this._getChar, we have updated the texture in this.atlas object
    // following we are returning the updated object
    // TODO: this code is not intuitive, we can write better
    return this.atlas.texture;
  }
  _getCharArray(charArray, char, height, dx, dy, markDirty) {
    const rect = char.rect || {};
    // rect.x rect.w rect.h rect.y are all atlas widths heigths x y positions etc
    charArray.push({
      width: rect.w,
      height: rect.h,
      left: rect.x / this.atlas.width, //position in atlas
      right: (rect.x + rect.w) / this.atlas.width, //position in atlas
      bottom: (rect.y + rect.h) / this.atlas.height,
      top: rect.y / this.atlas.height,
      dx: dx,
      dy: dy + char.top + (height - rect.h),
      advance: char.advance,
    });

    return charArray;
  }
  // function to align text left, right or center
  alignText(
    alignment,
    text,
    x,
    y,
    width,
    height,
    markDirty,
    widthArray,
    wordWidth,
    fontStyle
  ) {
    // x and y are the clipspace co-ordinates between 0 and 1
    // dx and dy shifts the position of label w.r.t possibly node
    // (TODO: dx and dy are calculated w.r.t what is not clear , please clear it if you find out)

    const textArray = text.split(' ');
    let dx = 0;

    // dy positioned so that if y< 0.5 i.e. for lower half of canvas it's length should increase dynamically
    // so that it characters don't go outside of canvas, also for y>0.5 , it's constant at a particular height
    // so that it for y===1 it doesn't go beyond the canvas

    let dy = y <= 0.5 ? (height / 3) * (textArray.length - 1) : -height / 3;
    // "ret" must be the return object. "ret" is always the return object
    let ret = [];

    switch (alignment) {
      case 'right':
        for (var i = 0; i < textArray.length; i++) {
          dx = x <= 0.5 ? 0 : -width;

          // logic here is wordWidth is the max length of word in the wordArray, so if we subtract
          // width of the word we are currently iterating on and then set dx as given below, we
          // will get the exact position from where to start

          dx += wordWidth - widthArray[i];
          text = textArray[i];
          for (var j = 0; j < text.length; j++) {
            const char = this._getChar(text[j], fontStyle, markDirty);
            let horiBearingX = 3;
            dx += horiBearingX;
            // get array of characters
            ret = this._getCharArray(ret, char, height, dx, dy, markDirty);
            dx += char.advance;
          }
          dy = dy - Math.floor(height / 3);
        }
        break;

      case 'center':
        for (var i = 0; i < textArray.length; i++) {
          dx = x <= 0.5 ? 0 : -width;
          dx += (wordWidth - widthArray[i]) / 2;
          text = textArray[i];
          for (var j = 0; j < text.length; j++) {
            const char = this._getChar(text[j], fontStyle, markDirty);
            let horiBearingX = 3;
            dx += horiBearingX;
            ret = this._getCharArray(ret, char, height, dx, dy, markDirty);

            dx += char.advance;
          }
          dy = dy - Math.floor(height / 3);
        }
        break;

      default:
        dx = x <= 0.5 ? 0 : -width;

        for (var i = 0; i < text.length; i++) {
          // changing line here when it encounters any whitespace character

          if (text[i] === ' ' && (i != 0 || i != text.length - 1)) {
            dx = x <= 0.5 ? 0 : -width;
            dy = dy - Math.floor(height / 3);
          } else {
            const char = this._getChar(text[i], fontStyle, markDirty);
            const rect = char.rect || {};
            let horiBearingX = 3;
            dx += horiBearingX;
            ret = this._getCharArray(ret, char, height, dx, dy, markDirty);
            dx += char.advance; // advancce is the width of the character
          }
        }
    }
    return ret;
  }
  /**
   * Updates the 'texture' member variable of this.atlas object
   *
   * markDirty = ??? callback to be called if the size of the texture is resized
   */
  _getChar(character, fontStyle, markDirty) {
    // curFont is same as style.pbf defined above
    // TODO: We are doing this too many times in this code. Find a better mech.
    const font = this.curFont;
    const spriteGenerator = new SpriteGenerator(fontStyle);
    // charCodeAt returns an integer between 0 and 65535 representing the UTF-16 code unit
    // refer https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/charCodeAt

    const glyphID = character.charCodeAt(0);

    // Padding around the glyph
    const buffer = 0;

    const cache = this._cachedGlyphs[font] || (this._cachedGlyphs[font] = {});
    const glyph =
      (cache[glyphID] && cache[glyphID].glyph) ||
      spriteGenerator.draw(character);

    const fontSize = spriteGenerator.fontSize;

    if (!this._rects[font]) this._rects[font] = {};
    let rect = (this._rects[font][character] = this.atlas.addGlyph(
      glyphID, // character id
      this.curFont, // contains url of the font file on server
      glyph, // glyph object
      buffer, // padding
      fontSize, // fontSize
      markDirty // callback function to be called if texture resizes
    ));
    return (
      cache[glyphID] || (cache[glyphID] = new SimpleGlyph(glyph, rect, buffer))
    );
  }

  get(text, x, y, markDirty) {
    const fontStyle = this.fontStyle;
    let alignment = fontStyle.alignment;

    //replaces the multiple space characters in the text with a single space
    text = text.replace(/\s+/g, ' ');

    let widthAndHeightObj = this.getWidthAndHeight(text, fontStyle, markDirty);
    let height = widthAndHeightObj.height;
    let width = widthAndHeightObj.width;
    let widthArray = widthAndHeightObj.widthArray;

    let ret = this.alignText(
      alignment,
      text,
      x,
      y,
      width,
      height,
      markDirty,
      widthArray,
      width,
      fontStyle
    );
    return ret;
  }

  steps(text) {
    return text.length;
  }

  bind() {
    this.atlas.updateTexture(this._gl);
  }
}
