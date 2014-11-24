/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Broad Institute
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 * Created by turner on 2/24/14.
 */
var igv = (function (igv) {



    igv.BAMTrack = function (config) {

        var coverageTrackHeightPercentage = 0.15;

        this.featureSource = new igv.BamSource(config);
        this.config = config;
        this.url = config.url;
        this.label = config.label || "";
        this.id = config.id || this.label;
        this.height = config.height || 400;
        this.alignmentRowHeight = config.expandedHeight || 14;
        this.alignmentRowYInset = 1;
        this.visibilityWindow = config.visibilityWindow || 30000;     // 30kb default
        this.alignmentColor =  config.alignmentColor || "rgb(185, 185, 185)";
        this.negStrandColor = config.negStrandColor || "rgb(150, 150, 230)";
        this.posStrandColor = config.posStrandColor || "rgb(230, 150, 150)";
        this.deletionColor =  config.deletionColor | "black";
        this.skippedColor = config.skippedColor || "rgb(150, 170, 170)";
        this.coverageColor = config.coverageColor || this.alignmentColor;


        // divide the canvas into a coverage track region and an alignment track region
        this.coverageTrackHeight = coverageTrackHeightPercentage * this.height - 5;

    };

    igv.BAMTrack.prototype.draw = function (canvas, refFrame, bpStart, bpEnd, width, height, continuation, task) {

//        console.log("bamTrack.draw");


        // Don't try to draw alignments for windows > the visibility window
        if (bpEnd - bpStart > this.visibilityWindow) {
            var x;
            for (x = 200; x < width; x += 400)
                canvas.fillText("Zoom in to see alignments", x, 20, {fillStye: 'black'});
            continuation();
            return;
        }

        var myself = this,
            chr = refFrame.chr,
            alignmentColor = this.alignmentColor,
            coverageColor = this.coverageColor,
            skippedColor = this.skippedColor,
            deletionColor = this.deletionColor;


        this.featureSource.getFeatures(chr, bpStart, bpEnd, function (features) {

                if (features) {

                    igv.sequenceSource.getSequence(chr, bpStart, bpEnd, function (refSeq) {
                            drawCoverage(features, refSeq);
                            drawAlignments(features, refSeq);
                            continuation();

                        },
                        task);

                } else {
                    continuation();
                }

            },
            task);


        function drawCoverage(features, refSeq) {
            var coverageMap = features.coverageMap,
                bp,
                x,
                y,
                w,
                h,
                refBase,
                i,
                len,
                item,
                accumulatedHeight,
                rect = { x: 0, y: 0, width: 0, height: 0 };
            if (refSeq) {
                refSeq = refSeq.toUpperCase();
            }
            // coverage track
            canvas.setProperties({ fillStyle: alignmentColor });
            canvas.setProperties({ strokeStyle: alignmentColor });


            if (coverageMap) {// TODO -- why is covereageMap sometimes undefined !?

                // paint backdrop color for all coverage buckets
                w = Math.max(1, 1.0 / refFrame.bpPerPixel);
                for (i = 0, len = coverageMap.coverage.length; i < len; i++) {

                    bp = (coverageMap.bpStart + i);
                    if (bp < bpStart) continue;
                    if (bp > bpEnd) break;

                    item = coverageMap.coverage[i];
                    if (!item) continue;

                    x = refFrame.toPixels(bp - bpStart);
                    h = (item.total / coverageMap.maximum) * myself.coverageTrackHeight;
                    y = myself.coverageTrackHeight - h;

                    canvas.setProperties({   fillStyle: coverageColor });
                    canvas.setProperties({ strokeStyle: coverageColor });
                    canvas.fillRect(x, y, w, h);

                } // for (coverageMap.coverage.length)
                // coverage mismatch coloring
                if (refSeq) {

                    w = Math.max(1, 1.0 / refFrame.bpPerPixel);

                    for (i = 0, len = coverageMap.coverage.length; i < len; i++) {

                        bp = (coverageMap.bpStart + i);
                        if (bp < bpStart) continue;
                        if (bp > bpEnd) break;

                        item = coverageMap.coverage[i];
                        if (!item) continue;

                        refBase = refSeq[i + coverageMap.bpStart - bpStart];
                        if (item.isMismatch(refBase)) {
                            x = refFrame.toPixels(bp - bpStart);
                            h = (item.total / coverageMap.maximum) * myself.coverageTrackHeight;
                            y = myself.coverageTrackHeight - h;
                            rect = { x: x, y: y, width: w, height: h };

                            canvas.setProperties({ fillStyle: igv.nucleotideColors[ refBase ] });
                            canvas.fillRect(rect.x, rect.y, rect.width, rect.height);
                            accumulatedHeight = 0.0;

                            coverageMap.coverage[i].mismatchPercentages(refBase).forEach(function (fraction, index, fractions) {
                                h = fraction.percent * (item.total / coverageMap.maximum) * myself.coverageTrackHeight;
                                y = (myself.coverageTrackHeight - h) - accumulatedHeight;
                                accumulatedHeight += h;
                                canvas.setProperties({ fillStyle: igv.nucleotideColors[ fraction.base ] });
                                canvas.fillRect(rect.x, y, rect.width, h);
                            });
                        }
                    }
                }
            }
        }

        function drawAlignments(features, refSeq) {

            if (refSeq) {
                refSeq = refSeq.toUpperCase();
            }
            // coverage track
            canvas.setProperties({ fillStyle: alignmentColor });
            canvas.setProperties({ strokeStyle: alignmentColor });

            // TODO -- features.packedAlignments can be undefined !!!
            if (features.packedAlignments) {
                // alignment track
                features.packedAlignments.forEach(function renderAlignmentRow(alignmentRow, packedAlignmentIndex, packedAlignments) {

                    var arrowHeadWidth = myself.alignmentRowHeight / 2.0,
                        yStrokedLine,
                        yRect,
                        height;
                    yRect = myself.alignmentRowYInset + myself.coverageTrackHeight + (myself.alignmentRowHeight * packedAlignmentIndex) + 5;
                    height = myself.alignmentRowHeight - (2 * myself.alignmentRowYInset);
                    yStrokedLine = (height / 2.0) + yRect;

                    alignmentRow.forEach(function renderAlignment(alignment) {
                        var xRectStart,
                            xRectEnd,
                            blocks = alignment.blocks,
                            len = alignment.blocks.length,
                            strand = alignment.strand,
                            blocksBBoxLength = alignment.lengthOnRef;

                        if ((alignment.start + blocksBBoxLength) < bpStart) return;
                        if (alignment.start > bpEnd) return;

                        xRectStart = refFrame.toPixels(alignment.start - bpStart);
                        xRectEnd = refFrame.toPixels((alignment.start + blocksBBoxLength) - bpStart);

                        if (blocks.length > 0) {
                            // todo -- set color based on gap type (deletion or skipped)
                            canvas.strokeLine(xRectStart, yStrokedLine, xRectEnd, yStrokedLine, {strokeStyle: skippedColor});
                        }

                        canvas.setProperties({fillStyle: alignmentColor});

                        blocks.forEach(function (block, blockIndex) {
                            var refOffset = block.start - bpStart,
                                blockRectX = refFrame.toPixels(refOffset),
                                blockEndX = refFrame.toPixels((block.start + block.len) - bpStart),
                                blockRectWidth = Math.max(1, blockEndX - blockRectX),
                                blockSeq = block.seq.toUpperCase(),
                                blockQual = block.qual,
                                refChar,
                                readChar,
                                readQual,
                                basePixelPosition,
                                basePixelWidth,
                                baseColor,
                                i;

                            if (strand && blockIndex === len - 1) {
                                x = [xRectStart, xRectEnd, xRectEnd + arrowHeadWidth, xRectEnd, xRectStart];
                                y = [yRect, yRect, yRect + height / 2, yRect + height, yRect + height];
                                canvas.fillPolygon(x, y);

                            } else if (!strand && blockIndex === 0) {
                                var x = [ blockRectX - arrowHeadWidth, blockRectX, blockEndX, blockEndX, blockRectX];
                                var y = [ yRect + height / 2, yRect, yRect, yRect + height, yRect + height];
                                canvas.fillPolygon(x, y);
                            } else {

                                canvas.fillRect(blockRectX, yRect, blockRectWidth, height);
                            }

                            // Only do mismatch coloring if a refseq exists to do the comparison
                            if (refSeq && blockSeq !== "*") {

                                for (i = 0, len = blockSeq.length; i < len; i++) {

                                    readChar = blockSeq.charAt(i);
                                    refChar = refSeq.charAt(refOffset + i);
                                    if (readChar === "=") {
                                        readChar = refChar;
                                    }

                                    if (readChar === "X" || refChar !== readChar) {
                                        if (blockQual && blockQual.length > i) {
                                            readQual = blockQual.charCodeAt(i) - 33;
                                            baseColor = shadedBaseColor(readQual, readChar);
                                        }
                                        else {
                                            baseColor = igv.nucleotideColors[readChar];
                                        }
                                        if (baseColor) {
                                            basePixelPosition = refFrame.toPixels((block.start + i) - bpStart);
                                            basePixelWidth = Math.max(1, refFrame.toPixels(1));
                                            canvas.fillRect(basePixelPosition, yRect, basePixelWidth, height, { fillStyle: baseColor });
                                        }
                                    }
                                }
                            } // if (refSeq)
                        });
                    });
                });
            }
        }

    };

    igv.BAMTrack.prototype.popupData = function (genomicLocation, xOffset, yOffset) {

        var coverageMap = this.featureSource.genomicInterval.coverageMap,
            coverageMapIndex,
            coverage,
            packedAlignments = this.featureSource.genomicInterval.packedAlignments,
            packedAlignmentsIndex,
            alignmentRow,
            alignment,
            nameValues = [],
            tmp, i, len;

        packedAlignmentsIndex = Math.floor((yOffset - (this.alignmentRowYInset + this.coverageTrackHeight)) / this.alignmentRowHeight);

        if (packedAlignmentsIndex < 0) {

            coverageMapIndex = genomicLocation - coverageMap.bpStart;
            coverage = coverageMap.coverage[ coverageMapIndex ];

            if (coverage) {


                nameValues.push(igv.browser.referenceFrame.chr + ":" + igv.numberFormatter(1 + genomicLocation));

                nameValues.push({name: 'Total Count', value: coverage.total});

                // A
                tmp = coverage.posA + coverage.negA;
                if (tmp > 0)  tmp = tmp.toString() + " (" + Math.floor(((coverage.posA + coverage.negA) / coverage.total) * 100.0) + "%)";
                nameValues.push({name: 'A', value: tmp});


                // C
                tmp = coverage.posC + coverage.negC;
                if (tmp > 0)  tmp = tmp.toString() + " (" + Math.floor((tmp / coverage.total) * 100.0) + "%)";
                nameValues.push({name: 'C', value: tmp});

                // G
                tmp = coverage.posG + coverage.negG;
                if (tmp > 0)  tmp = tmp.toString() + " (" + Math.floor((tmp / coverage.total) * 100.0) + "%)";
                nameValues.push({name: 'G', value: tmp});

                // T
                tmp = coverage.posT + coverage.negT;
                if (tmp > 0)  tmp = tmp.toString() + " (" + Math.floor((tmp / coverage.total) * 100.0) + "%)";
                nameValues.push({name: 'T', value: tmp});

                // N
                tmp = coverage.posN + coverage.negN;
                if (tmp > 0)  tmp = tmp.toString() + " (" + Math.floor((tmp / coverage.total) * 100.0) + "%)";
                nameValues.push({name: 'N', value: tmp});

            }

        }

        else if (packedAlignmentsIndex < packedAlignments.length) {

            alignmentRow = packedAlignments[ packedAlignmentsIndex ];

            alignment = undefined;

            for (i = 0, len = alignmentRow.length; i < len; i++) {

                tmp = alignmentRow[i];

                if (tmp.start <= genomicLocation && (tmp.start + tmp.lengthOnRef >= genomicLocation)) {
                    alignment = tmp;
                    break;
                }

            }

            if (alignment) {

                return alignment.popupData(genomicLocation);

            }
        }

        return nameValues;

    };

    function shadedBaseColor(qual, nucleotide) {

        var color,
            alpha,
            minQ = 5,   //prefs.getAsInt(PreferenceManager.SAM_BASE_QUALITY_MIN),
            maxQ = 20,  //prefs.getAsInt(PreferenceManager.SAM_BASE_QUALITY_MAX);
            foregroundColor = igv.nucleotideColorComponents[nucleotide],
            backgroundColor = [255, 255, 255];   // White

        if (!foregroundColor) return;

        if (qual < minQ) {
            alpha = 0.1;
        } else {
            alpha = Math.max(0.1, Math.min(1.0, 0.1 + 0.9 * (qual - minQ) / (maxQ - minQ)));
        }
        // Round alpha to nearest 0.1
        alpha = Math.round(alpha * 10) / 10.0;

        if (alpha >= 1) {
            color = igv.nucleotideColors[nucleotide];
        }
        else {
            color = "rgba(" + foregroundColor[0] + "," + foregroundColor[1] + "," + foregroundColor[2] + "," + alpha + ")";    //igv.getCompositeColor(backgroundColor, foregroundColor, alpha);
        }
        return color;
    }

    return igv;

})
(igv || {});
