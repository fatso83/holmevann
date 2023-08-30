var markdownpdf = require("markdown-pdf"),
  through2 = require("through2"),
  fs = require("fs");

var args = process.argv.slice(2);
var file = args[0];
var outputFile = file + ".pdf";

var START_TAG_STARTED = "START_TAG_STARTED";
var END_TAG_STARTED = "END_TAG_STARTED";
var NOT_IN_TAG = "NOT_IN_TAG";
var IN_TAG = "IN_TAG";

/** Print out a part of the buffer as text */
function str(buffer, start, end) {
  return buffer.slice(start, end).toString("utf-8");
}

fs.createReadStream(file)
  .pipe(
    markdownpdf({
      /** Implements a simple state machine that just strips away all links
       * in the markdown. Doesn't do links nested in links ... Don't think that is a problem. */
      preProcessHtml: function stripLinkTags() {
        var state = NOT_IN_TAG;
        return through2(function (chunk, enc, callback) {
          var newChunk = [];
          for (var i = 0; i < chunk.length; i++) {
            switch (state) {
              case NOT_IN_TAG: {
                if (str(chunk, i, i + 3) === "<a ") {
                  state = START_TAG_STARTED;
                  continue;
                } else newChunk.push(chunk[i]);
                break;
              }
              case START_TAG_STARTED: {
                if (chunk[i] === ">".charCodeAt()) {
                  state = IN_TAG;
                }
                continue;
                break;
              }
              case IN_TAG: {
                if (str(chunk, i, i + 4) === "</a>") {
                  state = END_TAG_STARTED;
                  continue;
                }
                newChunk.push(chunk[i]);
                break;
              }
              case END_TAG_STARTED: {
                if (str(chunk, i - 3, i + 1) === "</a>") {
                  state = NOT_IN_TAG;
                  continue;
                }
                break;
              }
              default:
                throw new TypeError("not possible");
            }
          }

          var newChunkAsBuffer = Buffer.from(newChunk);
          this.push(newChunkAsBuffer);

          callback();
        });
      },
    }),
  )
  .pipe(fs.createWriteStream(outputFile));
