const fs = require("fs")
const axios = require("axios")
const xml2js = require("xml2js")
const zlib = require("zlib")
const argv = require("yargs").argv

const pre = argv.base
const countries = argv.countries.split(",")
const post = ".xml.gz"
const dest = argv.dest

function download() {
    console.log(`Downloading ${countries.length} EPGs...`)

    axios
        .all(
            countries.map(country => {
                return axios({
                    url: `${pre}${country}${post}`,
                    method: "get",
                    responseType: "stream"
                })
            })
        )
        .then(
            axios.spread((...gzippedXmls) => {
                console.log("Downloads complete!")

                unzip(gzippedXmls)
            })
        )
}

function unzip(gzippedXmls) {
    console.log("Unzipping...")
    let unzippedXmls = []
    let count = 0

    gzippedXmls.forEach(gzippedXml => {
        const gzip = zlib.createUnzip()
        gzippedXml.data.pipe(gzip)

        let body = ""

        gzip.on("data", function(data) {
            if (data) body += data
        })

        gzip.on("end", function() {
            unzippedXmls[count] = body
            count = count + 1

            if (count === countries.length) {
                console.log("Unzipping complete")
                parse(unzippedXmls)
            }
        })
    })
}

function parse(unparsedXmls) {
    console.log("Parsing XML files...")
    let objects = []
    let count = 0

    unparsedXmls.forEach((x, i) => {
        const parser = new xml2js.Parser()
        parser.parseString(x, function(err, result) {
            objects[i] = result

            count = count + 1

            if (count === unparsedXmls.length) {
                console.log("Parsing done")
                merge(objects)
            }
        })
    })
}

function merge(objects) {
    console.log("Merging XML files...")
    let object = {
        tv: {
            $: {},
            channel: [],
            programme: []
        }
    }

    objects.forEach(o => {
        object.tv.$ = o.tv.$
        object.tv.channel = [...object.tv.channel, ...o.tv.channel]
        object.tv.programme = [...object.tv.programme, ...o.tv.programme]
    })

    const builder = new xml2js.Builder()
    let xml = builder.buildObject(object)

    console.log("Merging done")
    write(xml)
}

function write(xml) {
    console.log("Writing XML file to disk...")

    fs.writeFile(dest, xml, function(err) {
        if (err) {
            return console.log(err)
        }

        console.log("Done!")
    })
}

download()
