/*
Алгоритм считает, что карточки описывают маршрут,
у которого нет слияний, развилок и пересечений,
но при необходимости его можно доработать для корректной обработки таких случаев.

Входные данные:

var sorter = new Sorter(array);

array - массив объектов, где каждый объект описывает одну карточку.

[
	{
		from:    string, //обязательный! Название пункта отправления
		to:      string, //обязательный! Название пункта прибытия
		vehicle: string, //тип транспортного средства. [plane||train||airport bus]
		number:  string, //номер рейса
		seat:    string, //место
		gate:    string, //выход
		baggage: string  //информация о багаже
	},
	...
]

Выходные данные:

var arr    = sorter.getOrderedCardsArr();    //Такой же массив карточек, но в порядке следования по маршруту
var html   = sorter.getTripDiscritionHTML(); //Описание маршрута в виде html списка
var arr    = sorter.getTripDiscritionArr();	 //Массив, каждый элемент которого - текстовое описание одной карточки
var errors = sorter.getErrors();             //Вернет массив ошибок, если таковые были.

*/




var Sorter = function(input){

	var cards  = (Array.isArray(input) && input.length>0) ? input : false;
	var errors = [];
	var path   = [];
	var graph  = {};

	this.getErrors = function(){
		return errors.length > 0 ? errors : null;
	}

	this.getOrderedCardsArr = function(){

		if(!path)return false;

		var result = [];

		path.forEach(function(cardIdx, i) {
			result.push(cards[cardIdx]);
		});

		return result;
	};

	this.getTripDiscritionHTML = function(){

		if(!path)return false;

		var discriptionArr =  this.getTripDiscritionArr();
		var output = "";

		output = "<ul><li>"+discriptionArr.join("</li><li>")+"</li></ul>";

		return output;
	}

	this.getTripDiscritionArr = function(){

		if(!path)return false;

		var result = [];

		path.forEach(function(cardIdx, i) {
			var card = cards[cardIdx];
			result.push(getTextRepresentation(card));
		});

		return result;
	};



	//строим граф из карточек
	var buildGraph = function(cards){
		var graph = [];
		


		cards.forEach(function(card, i) {

			if( 
				typeof(card.from) !== "string" || card.from.length < 1 ||
				typeof(card.to)   !== "string" || card.to.length   < 1 ||
				card.to === card.from
			){
				console.error("badCard: "+i);
				errors.push({type: "badCard", cardIdx: i});
				return false;
			}


			//наносим на граф данные об отправлениях
			if(typeof graph[hashCode(card.from)] == 'undefined'){
				graph[hashCode(card.from)] = {
					name : card.from,
					departures : [i],
					arrivals : []
				}
			}else{
				graph[hashCode(card.from)].departures.push(i);
			}

			//наносим на граф данные о прибытиях
			if(typeof graph[hashCode(card.to)] == 'undefined'){

				graph[hashCode(card.to)] = {
					name : card.to,
					departures : [],
					arrivals : [i]
				}

			}else{
				graph[hashCode(card.to)].arrivals.push(i);

			}

		});

		//дополнительная проверка на случай, если все карточки окажутся невалидными
		return Object.keys(graph).length > 1 ? graph : false;
	};


	//находим на графе возможные маршруты из точек, которые не имеют входящих рейсов.
	var findPaths = function(graph, cards){
		

		var recursion = function(nodeIdx, mapping, graph){


			if(graph[nodeIdx].departures.length>0){
				
				

				if(graph[nodeIdx].departures.length>1){
					errors.push({type: "fork", text: "В маршруте найдена развилка, алгоритм может работать некорректно."});
					console.error("В маршруте найдена развилка, алгоритм может работать некорректно.");
					//тут можно добавить обработку развилок в маршруте.
				}

				//игнорируем возможные развилки и идем по первому пути
				var cardIdx = graph[nodeIdx].departures[0];
				
				//проверяем, чтоб карточка была неиспользованная
				if(!~mapping.usedCards.indexOf(cardIdx)){

					mapping.usedCards.push(cardIdx);
					var card = cards[cardIdx];
					
					mapping.path.push(cardIdx);

					mapping = recursion(hashCode(card.to), mapping, graph);

				}
				

			}
			
			return mapping;
		}

		//найдем наиболее подходящие на роль старта точки
		var suggestedStarts = [];
		
		for(var nodeIdx in graph){
			//ищем те, у которых нету прибытий
			if(graph[nodeIdx].arrivals.length==0){
				suggestedStarts.push(nodeIdx);
			}		 			
		}

		//в случае замкнутого маршрута без разницы, откуда его начинать
		var tryStarts = suggestedStarts.length > 0 ? suggestedStarts : [hashCode(cards[0].from)];
		
		var paths = []; //сюда соберем получившиеся возможные маршруты

		tryStarts.forEach(function(nodeIdx, i){
			var mapping = { 
				path : [],	   //сюда соберем список точек, через которые проследуем
				usedCards : [] //будем следить, чтобы карточка не использовалась дважды
			}

			var mapping = recursion(nodeIdx, mapping, graph);

			if(mapping.path.length>0){
				paths.push(mapping.path);
			}	
		});

		if(paths.length>1){
			errors.push({type: "severalStarts", text: "В маршруте найдено несколько возможных исходных точек, алгоритм может работать некорректно."});
			console.error("В маршруте найдено несколько возможных исходных точек, алгоритм может работать некорректно.");
			//тут можно добавить обработку слияний и нескольких стартов в маршруте.
		}

		return paths[0]; //игнорируем альтернативные маршруты
	};

	var getTextRepresentation = function(card){
		var represent = "";
		var c = card;
		switch (card.vehicle) {
			case "plane":

			
				var direction = "From "+c.from+", take flight "+(c.number ? c.number+" " : "")+" to "+c.to+".";

				var gate      = c.gate ? " Gate "+c.gate+"." : false;

				var seat      = c.seat ? " Seat "+c.seat+"." : false;

				var baggage   = c.baggage ? " "+c.baggage+"." : false;

				represent = direction+(gate ? gate : "")+(seat ? seat : "")+(baggage ? baggage : "");

		    break

		   	case "train":
		      	var direction = "Take train "+(c.number ? c.number+" " : "")+"from "+c.from+" to "+c.to+".";
		      	
		      	var seat      = c.seat ? " Seat "+c.seat+"." : " No seat assignment.";

		      	represent = direction + (seat ? seat : "");
		   	break
		   	case "airport bus":
		      	var direction = "Take the airport bus "+(c.number ? c.number+" " : "")+"from "+c.from+" to "+c.to+".";
		      	
		      	var seat      = c.seat ? " Seat "+c.seat+"." : " No seat assignment.";

		      	represent = direction + (seat ? seat : "");
		    break
			default:
		      	represent = "Go from: "+card.from+" to: "+card.to+".";
		    break
		}
		return represent;
	};

	var hashCode = function(raw) {
		//можно будет подстраховаться и использовать в графе хэши вместо настоящих названий пунктов.
		return raw;
	};


	graph = cards ? buildGraph(cards) : false;
	path  = graph ? findPaths(graph, cards) : false;
	
	if(!path){
		console.error("Неправильные входные данные");
	}
}