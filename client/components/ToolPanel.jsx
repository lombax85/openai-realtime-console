import { useEffect, useState } from "react";

const functionDescription = `
Call this function when a user asks for a color palette.
`;

const personInfoDescription = `
Call this function when a user asks for information about a person's name and surname.
`;

const sessionUpdate = {
  type: "session.update",
  session: {
    tools: [
      {
        type: "function",
        name: "display_color_palette",
        description: functionDescription,
        parameters: {
          type: "object",
          strict: true,
          properties: {
            theme: {
              type: "string",
              description: "Description of the theme for the color scheme.",
            },
            colors: {
              type: "array",
              description: "Array of five hex color codes based on the theme.",
              items: {
                type: "string",
                description: "Hex color code",
              },
            },
          },
          required: ["theme", "colors"],
        },
      },
      {
        type: "function",
        name: "get_person_info",
        description: personInfoDescription,
        parameters: {
          type: "object",
          strict: true,
          properties: {
            name: {
              type: "string",
              description: "Person's name",
            },
            surname: {
              type: "string",
              description: "Person's surname",
            },
          },
          required: ["name", "surname"],
        },
      },
    ],
    tool_choice: "auto",
  },
};

function FunctionCallOutput({ functionCallOutput, employees }) {
  //console.log("FunctionCallOutput");
  if (functionCallOutput.name === "display_color_palette") {
    const { theme, colors } = JSON.parse(functionCallOutput.arguments);

    const colorBoxes = colors.map((color) => (
      <div
        key={color}
        className="w-full h-16 rounded-md flex items-center justify-center border border-gray-200"
        style={{ backgroundColor: color }}
      >
        <p className="text-sm font-bold text-black bg-slate-100 rounded-md p-2 border border-black">
          {color}
        </p>
      </div>
    ));

    return (
      <div className="flex flex-col gap-2">
        <p>Theme: {theme}</p>
        {colorBoxes}
        <pre className="text-xs bg-gray-100 rounded-md p-2 overflow-x-auto">
          {JSON.stringify(functionCallOutput, null, 2)}
        </pre>
      </div>
    );
  }

  if (functionCallOutput.name === "get_person_info") {
    //console.log("get_person_info", functionCallOutput);
    const { name, surname } = JSON.parse(functionCallOutput.arguments);
    
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-xl font-bold">Ricerca per: {name} {surname}</h3>
        <div className="text-gray-600">
          {!employees ? (
            <p>Caricamento dati in corso...</p>
          ) : employees.length === 0 ? (
            <p>Nessun dipendente trovato</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {employees.map((employee, index) => (
                <div key={index} className="p-4 border rounded-md shadow-sm bg-white">
                  <h4 className="font-bold text-gray-800">{employee.name}</h4>
                  <p className="text-gray-600">{employee.role}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <pre className="text-xs bg-gray-100 rounded-md p-2 overflow-x-auto">
          {JSON.stringify(employees || functionCallOutput, null, 2)}
        </pre>
      </div>
    );
  }
}

export default function ToolPanel({
  isSessionActive,
  sendClientEvent,
  events,
}) {
  const [functionAdded, setFunctionAdded] = useState(false);
  const [functionCallOutput, setFunctionCallOutput] = useState(null);
  const [employees, setEmployees] = useState(null);
  const [lastProcessedEventsLength, setLastProcessedEventsLength] = useState(0);

  //console.log("ToolPanel render - events length:", events?.length, "lastProcessedEventsLength:", lastProcessedEventsLength);

  useEffect(() => {
    //console.log("useEffect triggered - events length:", events?.length, "lastProcessed:", lastProcessedEventsLength);
    
    if (!events || events.length === 0) {
      console.log("No events available");
      return;
    }

    const firstEvent = events[events.length - 1];
    if (!functionAdded && firstEvent.type === "session.created") {
      console.log("Adding functions to session");
      sendClientEvent(sessionUpdate);
      setFunctionAdded(true);
    }

    // Processa solo i nuovi eventi che non erano presenti nell'ultima elaborazione
    // Gli eventi sono ordinati dal più recente [0] al più vecchio [length-1]
    // I nuovi eventi sono dall'indice 0 fino a (events.length - lastProcessedEventsLength - 1)
    const newEventsCount = events.length - lastProcessedEventsLength;
    //console.log("New events to process:", newEventsCount);
    
    let eventsProcessed = 0;
    for (let i = 0; i < newEventsCount; i++) {
      //console.log("Processing event", i, "of", newEventsCount, "- Event type:", events[i]?.type);
      eventsProcessed++;
      const event = events[i];
      if (!event) continue;

      if (
        event.type === "response.done" &&
        event.response.output
      ) {
        //console.log("Found response.done event:", event);
        event.response.output.forEach((output) => {
          //console.log("Processing output:", output.name);
          //if (output.type === "function_call") {
            if (output.name === "display_color_palette") {
              setFunctionCallOutput(output);
              setTimeout(() => {
                sendClientEvent({
                  type: "response.create",
                  response: {
                    instructions: `
                    ask for feedback about the color palette - don't repeat 
                    the colors, just ask if they like the colors.
                  `,
                  },
                });
              }, 500);
            } else if (output.name === "get_person_info") {
              console.log("get_person_info", output);
              setFunctionCallOutput(output);
              // Fetch employees data when get_person_info is called
              fetch('/logotel-employees')
                .then(response => response.json())
                .then(data => {
                  setEmployees(data);
                  setTimeout(() => {
                    console.log("sending response.create", data);
                    sendClientEvent({
                      type: "response.create",
                      response: {
                        instructions: `
                        mostra i dati recuperati: ${JSON.stringify(data)}
                      `,
                      },
                    });
                  }, 500);
                })
                .catch(error => {
                  console.error('Error fetching employees:', error);
                  setTimeout(() => {
                    sendClientEvent({
                      type: "response.create",
                      response: {
                        instructions: `
                        Si è verificato un errore nel recupero dei dati. Vuoi riprovare?
                      `,
                      },
                    });
                  }, 500);
                });
            }
          //}
        });
      }
    }

    //console.log("Events processed in this cycle:", eventsProcessed);

    // Aggiorna la lunghezza degli eventi processati
    if (events.length > lastProcessedEventsLength) {
      //console.log("Updating lastProcessedEventsLength from", lastProcessedEventsLength, "to", events.length);
      setLastProcessedEventsLength(events.length);
    }
  }, [events, lastProcessedEventsLength, isSessionActive, sendClientEvent]);

  useEffect(() => {
    if (!isSessionActive) {
      setFunctionAdded(false);
      setFunctionCallOutput(null);
      setEmployees(null);
      setLastProcessedEventsLength(0);
    }
  }, [isSessionActive]);

  return (
    <section className="h-full w-full flex flex-col gap-4">
      <div className="h-full bg-gray-50 rounded-md p-4">
        <h2 className="text-lg font-bold">Tool Panel</h2>
        {isSessionActive ? (
          functionCallOutput ? (
            <FunctionCallOutput 
              functionCallOutput={functionCallOutput} 
              employees={employees}
            />
          ) : (
            <p>Chiedi informazioni su una palette di colori o su una persona...</p>
          )
        ) : (
          <p>Avvia la sessione per utilizzare questo strumento...</p>
        )}
      </div>
    </section>
  );
}
