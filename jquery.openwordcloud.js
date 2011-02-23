/**
* JQuery plugin to lay out and render a word cloud using the Canvas HTML5 element.
* See http://github.com/petewarden/openwordcloud for details.
*
*  Copyright (C) 2010 Pete Warden <pete@petewarden.com>
*
*    This program is free software: you can redistribute it and/or modify
*    it under the terms of the GNU General Public License as published by
*    the Free Software Foundation, either version 3 of the License, or
*    (at your option) any later version.
*
*    This program is distributed in the hope that it will be useful,
*    but WITHOUT ANY WARRANTY; without even the implied warranty of
*    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*    GNU General Public License for more details.
*
*    You should have received a copy of the GNU General Public License
*    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*
*/

(function ($) {

    $.fn.OpenWordCloud = function(targetSelector)
    {
        this.__construct__ = function(targetSelector) {

            this.width = $(targetSelector).width();
            this.height = $(targetSelector).height();

            // See http://diveintohtml5.org/detect.html#canvas
            var hasCanvas = !!document.createElement('canvas').getContext;
            
            if (!hasCanvas)
            {
                $(targetSelector).html('<br><br><center>This site requires HTML5/Canvas support, available in Firefox, Safari and Chrome</center>');
                return;
            }
        
            this.canvas = this.createCanvas(this.width, this.height);
            
            $(targetSelector)
            .empty()
            .append(this.canvas);

            var myThis = this;

            this.timer = setInterval( function() { myThis.heartbeat(); }, 500);
            
            this.settings = {
                'backgroundColor': '#ffffff',
                'textColor': '#000000',
                'font': 'Baskerville, Times New Roman, Serif',
                'smallestTextSize': 16,
                'largestTextSize': 64,
                'spacing': 1,
                'rotationType': 'random',
                'shapeImage': 'none',
                'maxIterations': 1500,
                'minDistance': 2,
                'maxDistance': 4,
                'sortBySize': true,
                'shapeText': "SHAPE\nTEXT",
                'searchWalk': 'spiral',
                'angleChange': (Math.PI/40),
                'isPaused': false,
                'isStopped': false,
                'failedTimeBeforeStopping': 2*60*1000,
                'hdScale': 2
            };
                        
            this.words = [];
            this.existingWords = this.createCanvas(this.width, this.height);
            this.existingWordsHD = this.createCanvas((this.width*this.settings.hdScale), (this.height*this.settings.hdScale));
            this.existingWordsMask = this.createCanvas(this.width, this.height);
            this.newWordMask = this.createCanvas(this.width, this.height);
            this.testMask = this.createCanvas(this.width, this.height);
            this.existingWordsPixels = null;
            this.wasPausedLastRender = false;
            this.timeSinceLastSuccess = 0;
            this.infiniteWords = false;
        };

        this.createCanvas = function(width, height) {
            return $(
                '<canvas '
                +'width="'+width+'" '
                +'height="'+height+'"'
                +'"></canvas>'
            );
        };

        this.beginDrawing = function(canvas) {
            var context = canvas.get(0).getContext('2d');
// Safari has a looong beachball sometimes on window close, and gdb indicates it's
// related to fonts and context saving, so removing this to see if it helps. It does
// mean taking a little more care with the context state, but shouldn't be a problem.
//            context.save();
            return context;
        };

        this.endDrawing = function(context) {
//            context.restore();
        };

        this.colorStringFromNumber = function(colorNumber, alpha) {
            var red = (colorNumber>>16)&0xff;
            var green = (colorNumber>>8)&0xff;
            var blue = (colorNumber>>0)&0xff;

            if (typeof alpha === 'undefined')
                alpha = 1.0;
                
            var result = 'rgba(';
            result += red;
            result += ',';
            result += green;
            result += ',';
            result += blue;
            result += ',';
            result += alpha;
            result += ')';
            
            return result;
        };

        this.heartbeat = function() {
            this.draw();
        };

        this.draw = function() {
        
            var isPaused = ((this.settings.isPaused)||(this.settings.isStopped));
            var wasPausedLastRender = this.wasPausedLastRender;
            this.wasPausedLastRender = isPaused;
            if (isPaused) {
                if (!wasPausedLastRender) {
                    context = this.beginDrawing(this.canvas);
         
                    this.update(context);
         
                    context.clearRect(0, 0, this.width, this.height);
                    context.drawImage(this.existingWords.get(0), 0, 0, this.width, this.height);

                    this.endDrawing(context);                
                }
                return;
            }

            if (this.insideDrawing) {
                return;
            }
            this.insideDrawing = true;
        
            context = this.beginDrawing(this.canvas);
 
            this.update(context);
 
            context.clearRect(0, 0, this.width, this.height);
            context.drawImage(this.existingWords.get(0), 0, 0, this.width, this.height);

            var word = this.getCurrentWord();
            if (word) {

                var textColor = this.settings.textColor;
                if (textColor == 'rainbow') {
                    textColor = this.rainbowColor();
                }

                context.fillStyle = textColor;            
                context.globalCompositeOperation = 'source-over';

                this.drawWord(context, word);
            }
            
            this.endDrawing(context);
            
            this.insideDrawing = false;
        };
        
        this.startFromText = function(text) {
        
            var wordFrequencies = this.wordFrequenciesFromText(text);
        
            this.startFromWordFrequencies(wordFrequencies);
        };
        
        this.wordFrequenciesFromText = function(text) {
        
            var stopWords = [ "a", "about", "above", "accordingly", "after",
                "again", "against", "ah", "all", "also", "although", "always", "am", "among", "amongst", "an",
                "and", "any", "anymore", "anyone", "are", "as", "at", "away", "be", "been",
                "begin", "beginning", "beginnings", "begins", "begone", "begun", "being",
                "below", "between", "but", "by", "ca", "can", "cannot", "come", "could",
                "did", "do", "doing", "during", "each", "either", "else", "end", "et",
                "etc", "even", "ever", "far", "ff", "following", "for", "from", "further", "furthermore",
                "get", "go", "goes", "going", "got", "had", "has", "have", "he", "her",
                "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", "into",
                "is", "it", "its", "itself", "last", "lastly", "less", "many", "may", "me",
                "might", "more", "must", "my", "myself", "near", "nearly", "never", "new",
                "next", "no", "not", "now", "o", "of", "off", "often", "oh", "on", "only",
                "or", "other", "otherwise", "our", "ourselves", "out", "over", "perhaps",
                "put", "puts", "quite", "s", "said", "saw", "say", "see", "seen", "shall",
                "she", "should", "since", "so", "some", "such", "t", "than", "that", "the",
                "their", "them", "themselves", "then", "there", "therefore", "these", "they",
                "this", "those", "though", "throughout", "thus", "to", "too",
                "toward", "unless", "until", "up", "upon", "us", "ve", "very", "was", "we",
                "were", "what", "whatever", "when", "where", "which", "while", "who",
                "whom", "whomever", "whose", "why", "with", "within", "without", "would",
                "yes", "your", "yours", "yourself", "yourselves", "rt", "http", "www", "com", "you", "de",
                "re", "ll", "ex", "didn", "mr", "mrs" 
            ];
            
            var stopWordsRE = new RegExp('\\s((' + stopWords.join('|') + ')\\s)+', 'gi');
            var lettersRE = /[^a-z0-9]/gi;
            var multipleSpacesRE = / +/gi;
            var singleLetterRE = / [a-z0-9] /gi;
            
            var wordString = text.replace(lettersRE, ' ').replace(stopWordsRE, ' ').replace(multipleSpacesRE, ' ').replace(singleLetterRE, ' ');
            var words = wordString.split(' ');
            
            var wordFrequencies = {};
            for (var wordIndex in words) {
                var word = words[wordIndex];
             
                if (typeof wordFrequencies[word] === 'undefined') {
                    wordFrequencies[word] = 0;
                }
                
                wordFrequencies[word] += 1;
            }
        
            return wordFrequencies;
        };
        
        this.startFromWordFrequencies = function(wordFrequencies) {
            var maxFrequency = 2;
            
            for (var word in wordFrequencies) {
                var wordFrequency = wordFrequencies[word];
                if (wordFrequency > maxFrequency) {
                    maxFrequency = wordFrequency;
                }
            }
            
            var smallestTextSize = parseInt(this.settings.smallestTextSize);
            var largestTextSize = parseInt(this.settings.largestTextSize);
            var textSizeDelta = (largestTextSize-smallestTextSize);
            
            var wordSizes = [];
            for (var word in wordFrequencies) {
                var wordFrequency = wordFrequencies[word];
                var wordRelativeFrequency = ((wordFrequency-1)/(maxFrequency-1));
                
                var wordSize = smallestTextSize+(wordRelativeFrequency*textSizeDelta);
                wordSizes.push({'text': word, 'size': wordSize});
            }
            
            this.startFromWordSizes(wordSizes, false);
        };

        this.startFromSmallText = function(words) {

            var wordFrequencies = this.wordFrequenciesFromText(words);

            var smallestTextSize = parseInt(this.settings.smallestTextSize);
            var largestTextSize = parseInt(this.settings.largestTextSize);
            var textSizeDelta = (largestTextSize-smallestTextSize);
            
            var wordSizes = [];
            for (var word in wordFrequencies) {
                var wordRelativeFrequency = Math.random();                    
                wordRelativeFrequency *= wordRelativeFrequency;
                wordRelativeFrequency *= wordRelativeFrequency;
                
                var wordSize = smallestTextSize+(wordRelativeFrequency*textSizeDelta);
                wordSizes.push({'text': word, 'size': wordSize});
            }
            
            this.startFromWordSizes(wordSizes, true);
        };

        this.update = function() {

            var halfWidth = (this.width/2);
            var halfHeight = (this.height/2);
            var spacing = this.settings.spacing;
            var searchWalk = this.settings.searchWalk;
            
            while (true) {

                var word = this.getCurrentWord();
                if (!word) {
                    break;
                }
                
                var minDistance = this.settings.minDistance*1;
                var maxDistance = this.settings.maxDistance*1;

                if (word.iterations==0) {
                
                    if (searchWalk=='outwards') {                
                
                        var angle = (Math.random()*Math.PI*2)-Math.PI;
                        var distance = Math.randomRange(minDistance, maxDistance, 0.01);
                        
                        word.deltaX = Math.cos(angle)*distance;
                        word.deltaY = Math.sin(angle)*distance;

                        word.x = (halfWidth+word.deltaX);
                        word.y = (halfHeight+word.deltaY);
                    
                    } else if (searchWalk=='spiral') {

                        word.angle = (Math.random()*Math.PI*2)-Math.PI;
                        word.angleDelta = (Math.random()<0.5)?(Math.PI/20):(-Math.PI/20);
                        word.distanceDelta = 0.3;
                        word.distance = word.distanceDelta;
                        
                        var deltaX = word.distance*Math.cos(word.angle);
                        var deltaY = word.distance*Math.sin(word.angle);
                        
                        word.x = (halfWidth+deltaX);
                        word.y = (halfHeight+deltaY);
                        
                    } else {

                        word.x = Math.randomRange(0, this.width-1);
                        word.y = Math.randomRange(0, this.height-1);                    
                    }
                    
                    word.rotation = this.getWordRotation();
                }
                
                var startTime = new Date().getTime();
                var successTime = startTime;
                
                while (word.iterations < this.settings.maxIterations) {
                    
                    if (this.doesWordFit(word)) {
                        break;
                    }

                    if (searchWalk=='random') {
                                    
                        word.x = Math.randomRange(0, this.width-1);
                        word.y = Math.randomRange(0, this.height-1);                    
                        word.rotation = this.getWordRotation();
                    
                    } else {
                    
                        if (searchWalk == 'outwards') {
                        
                            word.x += word.deltaX;
                            word.y += word.deltaY;
                        
                        } else {
                        
                            word.angle += word.angleDelta;
                            word.distance += word.distanceDelta;
                        
                            var deltaX = word.distance*Math.cos(word.angle);
                            var deltaY = word.distance*Math.sin(word.angle);
                            
                            word.x = (halfWidth+deltaX);
                            word.y = (halfHeight+deltaY);
                            word.rotation = this.getWordRotation();
                        }


                        if (searchWalk=='outwards') {                
                        
                            if ((word.x<0) || 
                                (word.x>this.width) ||
                                (word.y<0) ||
                                (word.y>this.height)) {
                                var angle = (Math.random()*Math.PI*2)-Math.PI;
                                var distance = Math.randomRange(minDistance, maxDistance, 0.01);
                                
                                word.deltaX = Math.cos(angle)*distance;
                                word.deltaY = Math.sin(angle)*distance;

                                word.x = (halfWidth+word.deltaX);
                                word.y = (halfHeight+word.deltaY);
                            }
                            
                        } else if (searchWalk=='spiral') {

                            if (word.distance>Math.max((this.width/2), (this.height/2))) {

                                word.angle = (Math.random()*Math.PI*2)-Math.PI;
                                word.angleDelta = (Math.random()<0.5)?(Math.PI/20):(-Math.PI/20);
                                word.distanceDelta = 0.3;
                                word.distance = word.distanceDelta;
                                
                                var deltaX = word.distance*Math.cos(word.angle);
                                var deltaY = word.distance*Math.sin(word.angle);
                                
                                word.x = (halfWidth+deltaX);
                                word.y = (halfHeight+deltaY);
                                
                                word.rotation = this.getWordRotation();
                            }
                        
                        }
                    }

                    word.iterations += 1;

                    var currentTime = new Date().getTime();
                    var sinceStart = (currentTime-startTime);
                    if (sinceStart>250) {
                        this.timeSinceLastSuccess += sinceStart; 
                        if (this.timeSinceLastSuccess>this.settings.failedTimeBeforeStopping) {
                            this.settings.isStopped = true;
                        }
                        return;
                    }
                }
                
                // Only draw the word if we could really find a place
                if (word.iterations < this.settings.maxIterations) {
                    this.addWordToLayout(word);
                    this.timeSinceLastSuccess = 0;
                }
                        
                word.isPositioned = true;                
            }
        };

        this.startFromWordSizes = function(wordSizes, infiniteWords) {

            this.inputWordSizes = wordSizes;
            this.words = [];
            this.settings.isPaused = false;
            this.settings.isStopped = false;
            this.infiniteWords = infiniteWords;

            var shapeImage = this.settings.shapeImage;
            if ((shapeImage == 'none') || (shapeImage == 'text')) {

                this.shapeImage = null;
                this.startAfterImageLoad();

            } else {
                this.shapeImage = new Image();
    
                var instance = this;
                this.shapeImage.onload = function() { instance.startAfterImageLoad(); };
                this.shapeImage.src = this.settings.shapeImage;
            }
        };
        
        this.startAfterImageLoad = function() {

            this.insideDrawing = false;

            var wordSizes = this.inputWordSizes;
            for (var wordIndex in wordSizes) {
                var wordData = wordSizes[wordIndex];
                wordData.isPositioned = false;
                wordData.iterations = 0;
                this.words.push(wordData);
            }

            if (this.settings.sortBySize) {
                this.words.sort(function(a, b) {
                    if (a.size>b.size) return -1;
                    else if (a.size<b.size) return 1;
                    else return 0; 
                });
            }
            
            var context = this.beginDrawing(this.existingWords);
            context.fillStyle = this.settings.backgroundColor;
            context.fillRect(0, 0, this.width, this.height);
            this.endDrawing(context);

            var context = this.beginDrawing(this.existingWordsHD);
            context.fillStyle = this.settings.backgroundColor;
            context.fillRect(0, 0, (this.width*this.settings.hdScale), (this.height*this.settings.hdScale));
            this.endDrawing(context);

            var context = this.beginDrawing(this.existingWordsMask);
            context.clearRect(0, 0, this.width, this.height);
            if ((this.shapeImage != null) || (this.settings.shapeImage=='text')) {
                context.fillStyle = 'rgba(255, 255, 255, 1.0)';
                context.fillRect(0, 0, this.width, this.height);
                context.fillStyle = '#000000';
                
                var shapeImage;
                var originalImageWidth;
                var originalImageHeight;
                if (this.settings.shapeImage=='text') {
                
                    var lines = this.settings.shapeText.split("\n");
                 
                    var fontSize = 64;
                    var lineHeight = (fontSize*1.2)

                    context.font = fontSize+'px '+this.settings.font;

                    var maxWidth = 1;
                    for (var lineIndex in lines) {

                        var line = lines[lineIndex];

                        var metrics = context.measureText(line);
                        var lineWidth = metrics.width;
                        maxWidth = Math.max(lineWidth, maxWidth);
                    }
                    
                    originalImageWidth = (maxWidth*1.1);
                    originalImageHeight = (lines.length*lineHeight);
                    var textImageCanvas = this.createCanvas(originalImageWidth, originalImageHeight);
                    
                    var textContext = this.beginDrawing(textImageCanvas);
                
                    textContext.font = 'bold '+fontSize+'px '+this.settings.font;
                    textContext.textBaseline = 'middle';
                    textContext.textAlign = 'center';
                    textContext.shadowBlur = 8;
                    textContext.shadowColor = 'rgba(0, 0, 0, 1.0)';

                    var posX = (originalImageWidth/2);
                    var posY = (lineHeight/2);
                    for (var lineIndex in lines) {

                        var line = lines[lineIndex];
                        
                        textContext.fillText(line, posX, posY);

                        posY += lineHeight;
                    }
                    
                    shapeImage = textImageCanvas.get(0);
                
                } else {
                    shapeImage = this.shapeImage;
                    
                    originalImageWidth = shapeImage.width;
                    originalImageHeight = shapeImage.height;
                }

                var widthScaleFactor = (this.width/originalImageWidth);

                var imageWidth = (originalImageWidth*widthScaleFactor);
                var imageHeight = (originalImageHeight*widthScaleFactor);
                
                if (imageHeight>this.height) {
                    var heightScaleFactor = (this.height/imageHeight);

                    imageWidth = (imageWidth*heightScaleFactor);
                    imageHeight = (imageHeight*heightScaleFactor);                
                }
                
                var left = (this.width-imageWidth)/2;
                var top = (this.height-imageHeight)/2;
                
                context.drawImage(shapeImage, left, top, imageWidth, imageHeight);

                var maskPixels = context.getImageData(0, 0, this.width, this.height);
                
                var pixelData = maskPixels.data;
                var dataLength = maskPixels.data.length;
                
                for (var pixelIndex=0; pixelIndex<dataLength; pixelIndex+=4) {
                    
                    var green = pixelData[pixelIndex+1];
                    var alpha;
                    if (green<127) {
                        alpha = 0;
                    } else {
                        alpha = 255;
                    }
                    pixelData[pixelIndex+3] = alpha;
                }
                
                context.putImageData(maskPixels, 0, 0, 0, 0, this.width, this.height);
            }
            context.strokeRect(0, 0, (this.width-1), (this.height-1));
            
            this.existingWordsMaskPixels = context.getImageData(0, 0, this.width, this.height);

            this.endDrawing(context);
        };

        this.doesWordFit = function(word) {

            var context = this.beginDrawing(this.newWordMask);

            context.font = word.size+'px '+this.settings.font;

            var metrics = context.measureText(word.text);
            var textWidth = Math.ceil(metrics.width+5);
            var textHeight = Math.ceil(word.size*1.5);

            if (this.doesWordLineOverlap(word, textWidth, this.existingWordsMaskPixels)) {
                return false;
            }

            var biggestDimension;
            if (textWidth>textHeight) {
                biggestDimension = textWidth;
            } else {
                biggestDimension = textHeight;
            }
            var halfDimension = (biggestDimension/2);
            
            var leftBounds = Math.gateInt((word.x-halfDimension), 0, this.width-1);
            var rightBounds = Math.gateInt((word.x+halfDimension), 0, this.width-1);
            var topBounds = Math.gateInt((word.y-halfDimension), 0, this.height-1);
            var bottomBounds = Math.gateInt((word.y+halfDimension), 0, this.height-1);

            context.shadowBlur = this.settings.spacing;
            context.shadowColor = 'rgba(0, 0, 0, 1.0)';
            context.fillStyle = 'rgba(0, 0, 0, 1.0)';
            context.globalCompositeOperation = 'darker';

            context.clearRect(0, 0, this.width, this.height);

            this.drawWord(context, word);            

            context.globalCompositeOperation = 'source-over';

            this.endDrawing(context);

            var context = this.beginDrawing(this.testMask);
            context.clearRect(0, 0, this.width, this.height);

            context.globalCompositeOperation = 'source-over';
            context.drawImage(this.existingWordsMask.get(0), 0, 0, this.width, this.height);

            context.globalCompositeOperation = 'source-in';
            context.drawImage(this.newWordMask.get(0), 0, 0, this.width, this.height);
            
            var maskPixels = context.getImageData(leftBounds, topBounds, (rightBounds-leftBounds), (bottomBounds-topBounds));

            this.endDrawing(context);
            
            var pixelData = maskPixels.data;
            var dataLength = maskPixels.data.length;
            
            for (var pixelIndex=0; pixelIndex<dataLength; pixelIndex+=4) {
                
                var alpha = pixelData[pixelIndex+3];
                if (alpha>0) {
                    return false;
                }
            }

            return true;
        };

        this.addWordToLayout = function(word) {

            var textColor = this.settings.textColor;
            if (textColor == 'rainbow') {
                textColor = this.rainbowColor();
            }

            var context = this.beginDrawing(this.existingWords);

            context.fillStyle = textColor;            
            context.globalCompositeOperation = 'source-over';

            this.drawWord(context, word);

            this.endDrawing(context);

            var context = this.beginDrawing(this.existingWordsHD);

            context.fillStyle = textColor;            
            context.globalCompositeOperation = 'source-over';

            this.drawWord(context, word, this.settings.hdScale);

            this.endDrawing(context);

            var context = this.beginDrawing(this.existingWordsMask);

            context.shadowBlur = this.settings.spacing;
            context.shadowColor = 'rgba(0, 0, 0, 1.0)';
            context.fillStyle = 'rgba(0, 0, 0, 1.0)';
            context.globalCompositeOperation = 'darker';

            this.drawWord(context, word);            

            this.existingWordsMaskPixels = context.getImageData(0, 0, this.width, this.height);

            context.shadowBlur = 0;
            context.globalCompositeOperation = 'source-over';

            this.endDrawing(context);
        };

        this.drawWord = function(context, word, scale) {
        
            if (typeof scale === 'undefined') {
                scale = 1.0;
            }
        
            try {
          
              var x = Math.floor(word.x*scale);
              var y = Math.floor(word.y*scale);
          
              context.font = (word.size*scale)+'px '+this.settings.font;
              context.textBaseline = 'middle';
              context.textAlign = 'center';
              context.setTransform(1, 0, 0, 1, 0, 0);
              context.translate(x, y);
              context.rotate(word.rotation);
              context.translate(-x, -y);
              context.fillText(word.text, x, y);
              context.setTransform(1, 0, 0, 1, 0, 0);
          
          } catch(err) {
          
              console.log('Exception:: - '+err);
          
          }
        };
        
        this.getWordRotation = function() {
        
            var rotationType = this.settings.rotationType;
            var result;
            if (rotationType=='across') {
                result = 0;
            } else if (rotationType=='up') {
                result = -(Math.PI/2.0);
            } else if (rotationType=='down') {
                result = (Math.PI/2.0);
            } else if (rotationType=='rightangle') {
                if (Math.random()<0.5) {
                    result = 0;
                } else {
                    result = -(Math.PI/2.0);
                }
            } else {
                result = (Math.random()*Math.PI)-(Math.PI/2);
            }
            
            return result;
        };
        
        this.toDataURL = function(type, width, height, credit, isHD) {
        
            if (typeof width === 'undefined') {
                width = this.width;
            }
            if (typeof height === 'undefined') {
                height = this.height;
            }

            if (typeof isHD === 'undefined') {
              isHD = false;
            }

            var scaledCanvas = this.createCanvas(width, height);
            
            var context = this.beginDrawing(scaledCanvas);

            var source;
            if (isHD) {
              source = this.existingWordsHD.get(0);
            } else {
              source = this.existingWords.get(0);
            }

            context.drawImage(source, 0, 0, width, height);

            if (typeof credit !== 'undefined') {

                var metrics = context.measureText(credit);

                var x = ((this.width-10)*this.settings.hdScale);
                var y = ((this.height-5)*this.settings.hdScale);
            
                context.font = (10*this.settings.hdScale)+'px '+this.settings.font;
                context.textBaseline = 'bottom';
                context.textAlign = 'right';
                context.fillText(credit, x, y);
            }
            
            this.endDrawing(context);
            
            return scaledCanvas.get(0).toDataURL(type);
        };
        
        this.rainbowColor = function() {
            var red = Math.randomRange(128, 255);
            var green = Math.randomRange(128, 255);
            var blue = Math.randomRange(128, 255);
            var result = '#'+red.toString(16)+green.toString(16)+blue.toString(16);
            
            return result;
        };
        
        this.doesWordLineOverlap = function (word, textWidth, maskPixels) {
        
            var halfWidth = (textWidth/2);
            var rotation = word.rotation;
            var originX = word.x;
            var originY = word.y;
            var lineDirectionX = (Math.cos(rotation)*halfWidth);
            var lineDirectionY = (Math.sin(rotation)*halfWidth);
        
            var lineStartX = (originX-lineDirectionX);
            var lineStartY = (originY-lineDirectionY);
            
            var maxIterations;
            var deltaX;
            var deltaY;
            if (Math.abs(lineDirectionX)>Math.abs(lineDirectionY)) {
                maxIterations = Math.abs(lineDirectionX);
            } else {
                maxIterations = Math.abs(lineDirectionY);            
            }
            deltaX = (lineDirectionX/maxIterations);
            deltaY = (lineDirectionY/maxIterations);

            var pixelData = maskPixels.data;
            var rowBytes = (this.width*4);

            var currentX = lineStartX;
            var currentY = lineStartY;
            
            for (var i=0; i<maxIterations; i+=1) {
              
                var xIndex = Math.floor(currentX);
                var yIndex = Math.floor(currentY);
                
                currentX += deltaX;
                currentY += deltaY;
                
                if ((xIndex<0) ||
                    (xIndex>=this.width) ||
                    (yIndex<0) ||
                    (yIndex>=this.height)) {
                    return true;
                }
            
                var pixelOffset = ((yIndex*rowBytes)+(xIndex*4)+3);
                var alpha = pixelData[pixelOffset];
                if (alpha>0) {
                    return true;
                }
            }
            
            return false;
        };
        
        this.getCurrentWord = function() {

            var words = this.words;
            for (var wordIndex in words) {
                var word = words[wordIndex];
                var isPositioned = word.isPositioned;
                if (isPositioned || (word.iterations>=this.settings.maxIterations)) {
                    continue;
                }

                return word;
            }
            
            if (this.infiniteWords) {
                this.randomizeWordSizes();
                return words[0];
            } else {
                return null;
            }
        };
        
        this.randomizeWordSizes = function() {

            var smallestTextSize = parseInt(this.settings.smallestTextSize);
            var largestTextSize = parseInt(this.settings.largestTextSize);
            var textSizeDelta = (largestTextSize-smallestTextSize);

            var words = this.words;
            for (var wordIndex in words) {
                var word = words[wordIndex];
                word.isPositioned = false;
                word.iterations = 0;

                var wordRelativeFrequency = Math.random();                    
                wordRelativeFrequency *= wordRelativeFrequency;
                wordRelativeFrequency *= wordRelativeFrequency;
                
                word.size = smallestTextSize+(wordRelativeFrequency*textSizeDelta);
            }        
        };

        this.__construct__(targetSelector);

        return this;
    };

}(jQuery));

// See http://roshanbh.com.np/2008/09/get-random-number-range-two-numbers-javascript.html
// I'm not actually convinced that this is an even distribution (0 only comes up if random()
// gives 0.0 to 0.5, whereas 1 has 0.5 to 1.5) but for display purposes it's good enough
Math.randomRange = function(minVal,maxVal,floatVal) {
    var randVal = minVal+(Math.random()*(maxVal-minVal));
    return typeof floatVal=='undefined'?Math.round(randVal):Number(randVal.toFixed(floatVal));
};

Math.gate = function(input, minVal, maxVal) {
    return Math.max(Math.min(input, maxVal), minVal);
};

Math.gateInt = function(input, minVal, maxVal) {
    return Math.gate(Math.round(input), Math.round(minVal), Math.round(maxVal));
};