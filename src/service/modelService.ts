import {SgModel} from "../model/sgModel";
import {SgUser} from "../model/sgUser";


async function getModel(modelName:string):Promise<SgModel | null> {

    if(modelName == null)
        return null;

    const model = await SgModel.query().where('name', modelName).first();
    console.log("getModel:", model);

    return model;
}

export default {
    getModel
}
