self.addEventListener("install", function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

function randomBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function wait(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function bodySegments(text) {
  var segments = [];
  var pattern = /<\/(?:tr|p|div|table|form|center|body|html)>/ig;
  var last = 0;
  var match;

  while ((match = pattern.exec(text))) {
    segments.push(text.slice(last, pattern.lastIndex));
    last = pattern.lastIndex;
  }

  if (last < text.length) segments.push(text.slice(last));
  return segments;
}

function groupSegments(segments, totalLength) {
  var desired = Math.max(8, Math.min(22, Math.round(totalLength / 850)));
  var target = Math.max(260, Math.round(totalLength / desired));
  var chunks = [];
  var current = "";
  var threshold = target * randomBetween(65, 145) / 100;
  var i;

  for (i = 0; i < segments.length; i++) {
    current += segments[i];
    if (current.length >= threshold) {
      chunks.push(current);
      current = "";
      threshold = target * randomBetween(55, 155) / 100;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function splitHtml(text) {
  var headMatch = /<head\b[^>]*>/i.exec(text);
  var bodyMatch = /<body\b[^>]*>/i.exec(text);
  var firstEnd;
  var bodyEnd;
  var chunks;
  var segments;

  if (!headMatch || !bodyMatch) return [text];

  firstEnd = headMatch.index + headMatch[0].length;
  bodyEnd = bodyMatch.index + bodyMatch[0].length;
  segments = bodySegments(text.slice(bodyEnd));
  chunks = [text.slice(0, firstEnd), text.slice(firstEnd, bodyEnd)];
  return chunks.concat(groupSegments(segments, text.length));
}

function streamHtml(text, response) {
  var chunks = splitHtml(text);
  var encoder = new TextEncoder();
  var headers = new Headers(response.headers);

  headers.delete("content-length");
  headers.delete("content-encoding");

  return new Response(new ReadableStream({
    start: function (controller) {
      return (async function () {
        var i;
        var initialCount = Math.min(3, chunks.length);

        for (i = 0; i < initialCount; i++) {
          controller.enqueue(encoder.encode(chunks[i]));
        }

        for (i = initialCount; i < chunks.length; i++) {
          if (Math.random() < 0.12) {
            await wait(randomBetween(300, 620));
          } else {
            await wait(randomBetween(55, 175));
          }
          controller.enqueue(encoder.encode(chunks[i]));
        }

        controller.close();
      })().catch(function (error) {
        controller.error(error);
      });
    }
  }), {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;

  if (request.mode !== "navigate" || request.method !== "GET") return;

  event.respondWith(fetch(request).then(function (response) {
    var type = response.headers.get("content-type") || "";

    if (!response.ok || type.toLowerCase().indexOf("text/html") === -1) {
      return response;
    }

    return response.text().then(function (text) {
      return wait(randomBetween(430, 780)).then(function () {
        return streamHtml(text, response);
      });
    });
  }).catch(function () {
    return fetch(request);
  }));
});
