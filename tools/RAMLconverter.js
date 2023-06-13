

myRAMLtoPostman = function (inputPath) {
    const { Console } = require('console'); 
    
    var path = require('path');
    var fs = require('fs');

    const { Collection, Item, Header } = require('postman-collection');

    Converter = require('raml1-to-postman');

    function fromDir(startPath, filter) {

        console.log('Starting from dir '+startPath+'/');
    
        if (!fs.existsSync(startPath)) {
            console.log("no dir ", startPath);
            return;
        }
    
        var files = fs.readdirSync(startPath);
        console.log("files are:", files);
        for (var i = 0; i < files.length; i++) {
            var filename = path.join(startPath, files[i]);
            if (filename.endsWith(filter)) {
                console.log('-- found: ', filename);
                return filename;
            };
        };
        console.log("no raml ", startPath);
    };

    fullPath = fromDir(inputPath, '.raml');
    console.log('full path is', fullPath);

    const regexFileName = /\/(?:.(?!\/))+$/gm;
    const fileName = fullPath.match(regexFileName)[0].replace('/','');
    console.log(fileName);

    const pathWithoutFile = fullPath.replace(fileName,'');
    console.log(pathWithoutFile);
    ramlSpec = fs.readFileSync(fullPath, {encoding: 'UTF8'});
    


    //empty postman collection
    const postmanCollection = new Collection({
        info: {
          // Name of the collection
          name: fileName.replace('.raml','')
        },
        // Requests in this collection
        item: [],
      });

    //adding fragments from files into RAML
    function addingFragments (ramlSpec, pathWithoutFile){
        //finding includes
        const regex = /!include.*/g;
        const includeArray = ramlSpec.match(regex);
        console.log(includeArray);

        //calculate white space
        const regexWholeLine = /^.*!include.*/gm;
        const includeArrayWholeLine = ramlSpec.match(regexWholeLine);
        const includeWhiteSpacesArray = [];
        includeArrayWholeLine.forEach(element => includeWhiteSpacesArray.push(element.length - element.trimStart().length));

        
        //read include files and add to a map
        const includeMap = new Map();
        includeArray.forEach(element => 
            {
                element = element.trim();
                var includePath = element.replace('!include', '');
                var includeFilePath = pathWithoutFile.concat(includePath).replace(' ','');
                if(includeFilePath.includes('../')){
                    includeFilePath = includeFilePath.replace('../','');
                }
                ramlFragment = fs.readFileSync(includeFilePath, {encoding: 'UTF8'});
                includeMap.set(element, ramlFragment)
            });
        
        //replace include with contents from files
        function replaceIncludeWithFileContent(element, index){
            element = element.trim();
            var value = includeMap.get(element);
            //add fake request
            if(element.includes('types')){
                //manipulate white space 
                const paddedNewLine = '\n'.padEnd(includeWhiteSpacesArray[index]+2,' ');
                value = value.replaceAll('\n',paddedNewLine);
                const regex2 = /(properties.*)/s;
                value = paddedNewLine + value.match(regex2)[0];
            }
            else if(element.includes('example')){
                const paddedNewLine = '\n'.padEnd(includeWhiteSpacesArray[index]+2,' ');
                value = value.replaceAll('\n',paddedNewLine);
                value = paddedNewLine + value;
                //console.log('examples:',index , value);
            }
            else if (element.includes('traits')){
                //remove first line
                regexTraitsFile = /#%RAML.*/gm;  
                value = value.replace(regexTraitsFile,'');
                value = value.replace('\n','');
                const paddedNewLine = '\n'.padEnd(includeWhiteSpacesArray[index]+2,' ');
                value = value.replaceAll('\n',paddedNewLine);
            }
            else {
                //replacing 
                console.log('others:',index , value);
            }
            ramlSpec = ramlSpec.replace(element,value);
        };
        includeArray.forEach(replaceIncludeWithFileContent);
        //console.log(ramlSpec);
  

        return ramlSpec;
    }

    //replace all includes
    var newRamlSpec = addingFragments(ramlSpec,pathWithoutFile);
    while(newRamlSpec.includes('!include')){
        newRamlSpec = addingFragments(newRamlSpec,pathWithoutFile);
    }

    console.log(newRamlSpec);
    //add this request for a workaround of the bug
    fakeRequest = '/fakequest: \n  post:\n    body:\n    responses:\n      200:\n        body:\n          application/json:\n            example: {"code": 200,"status": "OK"}\n\n';
    //regexFirstRequest = /^\s*\//gm;
    regexFirstRequest = /^\s*\/.*/gm;
    firstRequest = newRamlSpec.match(regexFirstRequest)[0];
    //console.log(firstRequest);
    newRamlSpec = newRamlSpec.replace(firstRequest,fakeRequest + firstRequest);
    console.log(newRamlSpec);

    //console.log(addingFragments(ramlSpec,pathWithoutFile));
    //convert raml to postman collection
    Converter.convert({ type: 'string', data: newRamlSpec, options:
        {
            collapseFolders: true,
            requestParametersResolution: 'Example',
            exampleParametersResolution: 'Example'
        }},
    {}, (err, conversionResult) => {
        if (!conversionResult.result) {
        console.log('Could not convert', conversionResult.reason);
        }
        else {
            //console.log('The collection object is: ', conversionResult.output[0].data);
            conversionResult.output[0].data.item.shift();
            console.log('The collection object is: ', conversionResult.output[0].data);
            postmanCollection.items.add(conversionResult.output[0].data);
            const collectionJSON = postmanCollection.toJSON();
            fs.writeFile(fileName.replace('.raml','') + '-collection' + '.json', JSON.stringify(collectionJSON), (err) => {
                if (err) { console.log(err); }
                console.log('File saved');
            });
        }
    }
    ); 
}; 

//call the function
//myFun('/Users/work/Desktop/Mainova/api/s-ams-api.raml');
myRAMLtoPostman(process.argv[2]);