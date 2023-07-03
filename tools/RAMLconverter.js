

myRAMLtoPostman = function (inputPath) {
    const { Console } = require('console'); 
    
    var path = require('path');
    var fs = require('fs');

    const { Collection, Item, Header } = require('postman-collection');

    Converter = require('raml1-to-postman');

    function fromDir(startPath, filter) {

        console.log('Starting from dir '+startPath+'/');
        if (!fs.existsSync(startPath)) {
            console.log("not a legit folder ", startPath);
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

    const mainPathWithoutFile = fullPath.replace(fileName,'');
    console.log(mainPathWithoutFile);
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
    function addingFragments (ramlSpec, mainPathWithoutFile){
        //finding includes
        const regex = /!include.*/g;
        const includeArray = ramlSpec.match(regex);
        console.log(includeArray);

        //calculate white space
        const regexWholeLine = /^.*!include.*/gm;
        const includeArrayWholeLine = ramlSpec.match(regexWholeLine);
        console.log('includeArrayWholeLine:', includeArrayWholeLine)
        const includeWhiteSpacesArray = [];
        includeArrayWholeLine.forEach(element => includeWhiteSpacesArray.push(element.length - element.trimStart().length));

        
        //read include files and add to a map
        const includeMap = new Map();
        includeArray.forEach((element, index) => 
            {
                element = element.trim();
                var includePath = element.replace('!include', '');
                var includePathWithoutFile = includePath.replace(regexFileName,'/');;
                var includeFilePath = mainPathWithoutFile.concat(includePath).replaceAll(' ','');
                var includeFilePathWithoutFile = includeFilePath.replace(regexFileName,'/');;
                if(includeFilePath.includes('../')){
                    includeFilePath = includeFilePath.replace('../','');
                }
                ramlFragment = fs.readFileSync(includeFilePath, {encoding: 'UTF8'});
                regexTraitsFile = /#%RAML.*/gm;
                
                //replace include with contents from files
                if(ramlFragment.includes('!include')){
                    const includeFragArray = ramlFragment.match(regex);
                    includeFragArray.forEach((includeElement, includeIndex) => 
                    {
                        console.log('checking includes',includeIndex , includeElement);
                        includeElementPath = mainPathWithoutFile.concat(includeElement.replace('!include ',''));
                        if(fs.existsSync(includeElementPath)){
                            console.log('True!');
                        }
                        else{
                            console.log('false');
                            console.log('includePath: ', includeElementPath);
                            if(!includeElement.includes('..')){
                                includeElementPath = includePathWithoutFile.concat(includeElement.replace('!include ',''));
                                console.log('includePath after: ', includeElementPath);
                                ramlFragment = ramlFragment.replace(includeElement,'!include ' + includeElementPath);
                            }
                        }
                    });              
                }
                    if(element.includes('types')|ramlFragment.includes('DataType')){
                        //manipulate white space 
                        const paddedNewLine = '\n'.padEnd(includeWhiteSpacesArray[index]+2,' ');
                        ramlFragment = ramlFragment.replaceAll('\n',paddedNewLine);
                        const regex2 = /(properties.*)/s;
                        if(ramlFragment.match(regex2) != null){
                            ramlFragment = paddedNewLine + ramlFragment.match(regex2)[0];
                        }
                    }
                    else if(element.includes('example')){
                        const paddedNewLine = '\n'.padEnd(includeWhiteSpacesArray[index]+2,' ');
                        ramlFragment = ramlFragment.replaceAll('\n',paddedNewLine);
                        ramlFragment = paddedNewLine + ramlFragment;
                    }
                    else if (element.includes('traits')|ramlFragment.includes('Trait')){
                        //manipulate white space 
                        const paddedNewLine = '\n'.padEnd(includeWhiteSpacesArray[index]+2,' ');
                        ramlFragment = ramlFragment.replaceAll('\n',paddedNewLine);
                    }
                    else{
                        //not replacing 
                        console.log('others (not replacing ):',index , ramlFragment);
                        ramlFragment = element; 
                    }
                //remove first line
                ramlFragment = ramlFragment.replace(regexTraitsFile,'');   
                ramlSpec = ramlSpec.replace(element,ramlFragment);
            });
        return ramlSpec;
    }

    //replace all includes
    var newRamlSpec = addingFragments(ramlSpec,mainPathWithoutFile);
    while(newRamlSpec.includes('!include')){
        newRamlSpec = addingFragments(newRamlSpec,mainPathWithoutFile);
    }

    //add this request for a workaround of the bug
    fakeRequest = '/fakequest: \n  post:\n    body:\n     application/json:\n    responses:\n      200:\n        body:\n          application/json:\n            example: {"code": 200,"status": "OK"}\n\n';
    regexFirstRequest = /^\s*\/.*/gm;
    firstRequest = newRamlSpec.match(regexFirstRequest)[0];
    newRamlSpec = newRamlSpec.replace(firstRequest,fakeRequest + firstRequest);
    /*fs.writeFile('newRamlSpec.RAML',newRamlSpec,(err) => {
        if (err) { console.log(err); }
        console.log('newRamlSpec saved');
    });*/

    function replaceObjectValue(obj){
        for(const key of Object.keys(obj)){
         if (typeof obj[key] === 'object'){
            replaceObjectValue(obj[key]);
         }
         if (key === 'header'){
            if(obj[key] != null){
                obj[key].forEach((element, index) =>{
                    if(element.key != 'Content-Type'){
                        element.value = '{{'+element.key+'}}' 
                    }
                })
            }
         }
        }
    };

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
            replaceObjectValue(collectionJSON);
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