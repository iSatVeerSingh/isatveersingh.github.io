const BASE_URL =
  "https://script.google.com/macros/s/AKfycby7TotD0Mea7-HvWraQu3PwiOIvQ2o5FUMA1yxY3hJycv6EVUQC90QUHT6ck3wYUTqc/exec";

pdfMake.fonts = {
  Times: {
    normal: "Times-Roman",
    bold: "Times-Bold",
    italics: "Times-Italic",
    bolditalics: "Times-BoldItalic",
  },
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const docDef = {
  pageSize: {
    width: 595,
    height: 842,
  },
  header: function (currentPage) {
    return currentPage === 1
      ? undefined
      : {
          table: {
            widths: ["*", 30],
            body: [
              [
                {
                  image: logoimg,
                  marginLeft: 20,
                  marginTop: 10,
                  width: 50,
                },
                {
                  text: currentPage.toString(),
                  alignment: "right",
                  marginRight: 40,
                  marginTop: 10,
                },
              ],
            ],
          },
          layout: "noBorders",
        };
  },
  pageOrientation: "portrait",
  pageMargins: [50, 60, 50, 25],
  content: [
    {
      image: topimg,
      width: 595,
      absolutePosition: { x: 0, y: 0 },
    },
    {
      image: bottomimg,
      width: 595,
      height: 225,
      absolutePosition: { x: 0, y: 617 },
    },
    {
      image: companyimg,
      width: 200,
      absolutePosition: { x: 350, y: 736 },
    },
    {
      image: logoimg,
      width: 250,
      marginTop: 100,
      alignment: "center",
    },
  ],
  defaultStyle: {
    font: "Times",
    lineHeight: 1.2,
    fontSize: 11,
    columnGap: 10,
  },
  styles: {
    headingText: {
      fontSize: 13,
      bold: true,
      lineHeight: 1,
      color: "#ffffff",
      marginTop: -15,
      marginLeft: 5,
      width: 500,
    },
    heading: {
      marginBottom: 10,
    },
    detailStack: {
      marginBottom: 15,
    },
    propertyName: {
      bold: true,
    },
    detailSmall: {
      marginBottom: 3,
      fontSize: 11,
      marginLeft: 5,
    },
    normalText: {
      marginLeft: 5,
    },
    itemName: {
      fontSize: 12,
      bold: true,
    },
  },
};

window.addEventListener("load", async () => {
  const message = document.getElementById("message");
  const loader = document.getElementById("loader");

  message.innerHTML = "Please wait while loading all available folders";
  loader.style.display = "block";

  const folderNames = await getAllFolderNames();
  if (!folderNames) {
    message.innerHTML =
      "Something went wrong. Please refresh the page and try again";
    message.style.color = "red";
    loader.style.display = "none";
    return;
  }

  if (Array.isArray(folderNames)) {
    if (folderNames.length === 0) {
      message.innerHTML = "No pending report folders found.";
      loader.style.display = "none";
      return;
    }

    const folderSelect = document.getElementById("folderSelect");

    folderNames.forEach((folder) => {
      const opt = document.createElement("option");
      (opt.textContent = folder[0]), (opt.value = folder[1]);

      folderSelect.appendChild(opt);
    });

    message.innerHTML = `Please select a folder from list and click on "Generate Button" to generate the report`;
    loader.style.display = "none";
  }

  const btn = document.getElementById("submitBtn");
  btn.addEventListener("click", async () => {
    try {
      const folderSelect = document.getElementById("folderSelect");

      const folderid = folderSelect.value.toString().trim();
      if (folderid === "") {
        message.innerHTML = "Please select a folder.";
        message.style.color = "red";
        loader.style.display = "none";
        return;
      }

      message.innerHTML =
        "Report generation started. Fetching report data and customer info...";
      loader.style.display = "block";
      btn.disabled = true;
      btn.classList.add("disabled");

      const reportData = await getReportData(folderid);
      if (!reportData) {
        message.innerHTML =
          "Something went wrong. Please refresh the page and try again";
        message.style.color = "red";
        loader.style.display = "none";
        return;
      }

      message.innerHTML = "Adding customer info...";

      const customerDocDef = getCustomerInfoDocDef(reportData.customerInfo);
      docDef.content.push(...customerDocDef);

      message.innerHTML = "Adding inspection notes...";

      const inspectionNotesDef = getInspectionNotesDef(
        reportData.inspectionNotes
      );
      docDef.content.push(inspectionNotesDef);

      message.innerHTML = "Adding template data...";

      const generalPuposeDef = getGeneralAndPurposDef();
      docDef.content.push(...generalPuposeDef);

      const table = {
        widths: [20, "*"],
        body: [],
      };

      for (let i = 0; i < reportData.itemsFiles.length; i++) {
        const file = reportData.itemsFiles[i];
        message.innerHTML = `Fetching item ${i + 1}  "${file.name}"`;

        const itemData = await getItemData(file.id);
        if (!itemData) {
          document.getElementById(
            "secondMessage"
          ).innerHTML = `Could not find the item "${file.name}" in temp storage folder so skipped.`;
          continue;
        }

        const {
          itemName,
          itemNote,
          type,
          itemImages,
          openingParagraph,
          closingParagraph,
        } = itemData;
        const itemNameCategory = itemName.split(":-");
        const reportItem = {
          stack: [
            {
              text: itemNameCategory[1],
              style: "itemName",
            },
          ],
        };
        if (type === "predefined") {
          const jsonFileName = `${itemNameCategory.join("-")}.json`
            .toLowerCase()
            .split(" ")
            .join("-")
            .split("/")
            .join("-");

          const itemInLibrary = await getLibraryItem(jsonFileName);

          if (!itemInLibrary) {
            document.getElementById(
              "secondMessage"
            ).innerHTML = `Could not find the item "${itemName}" in items library and this is not a custom item so skipped.`;
            continue;
          }

          for (let j = 0; j < itemInLibrary.children.length; j++) {
            const child = itemInLibrary.children[j];

            if (child.type === "PARAGRAPH") {
              reportItem.stack.push({
                text: child.children,
              });
            } else if (child.type === "INLINE_IMAGE") {
              reportItem.stack.push({
                image: child.image,
                width: 250,
                alignment: "center",
              });
            } else {
              reportItem.stack.push({
                text: "Note:- " + itemNote,
              });

              reportItem.stack.push(...getItemImagesDef(itemImages));
            }
          }
        } else {
          reportItem.stack.push({
            text: openingParagraph,
          });
          reportItem.stack.push(...getItemImagesDef(itemImages));
          reportItem.stack.push({
            text: closingParagraph,
          });
        }

        table.body.push([i + 1, reportItem]);

        message.innerHTML = "Added item " + (i + 1).toString();
        document.getElementById(
          "itemMessage"
        ).innerHTML = `"${itemName}" has added.`;
      }

      docDef.content.push(
        {
          pageBreak: "before",
          stack: [
            {
              stack: [
                {
                  canvas: [
                    {
                      type: "rect",
                      x: 0,
                      y: 0,
                      w: 495,
                      h: 20,
                      color: "#002060",
                    },
                  ],
                },
                {
                  tocItem: true,
                  text: "Schedule of Building Defects",
                  style: "headingText",
                },
              ],
              style: "heading",
            },
            {
              text: `The following is a list of newly identified defects that exist in the finishes and the quality of those finishes, for which rectification can reasonably be expected to be the responsibility of the builder.`,
              style: "normalText",
            },
          ],
          style: "detailStack",
        },
        {
          table: table,
          layout: {
            vLineWidth: function (i, node) {
              return i === 0 || i === node.table.widths.length ? 1 : 0;
            },
            hLineColor: "#002060",
            vLineColor: "#002060",
            paddingTop: function (i, node) {
              return 5;
            },
          },
        }
      );

      docDef.content.push(...getResponsibilityAndTermsDef());

      const footer = `${reportData.customerInfo.jobNumber} - ${reportData.customerInfo.reportType} Inspection Report`;

      docDef.footer = {
        text: footer,
        color: "#002060",
        fontSize: 10,
        font: "Helvetica",
        marginLeft: 40,
      };

      const reportGenDate = new Date();
      const day = getFormatDateValue(reportGenDate.getDate().toString());
      const month = getFormatDateValue(
        (reportGenDate.getMonth() + 1).toString()
      );
      const year = reportGenDate.getFullYear().toString();

      const newFolderName = `${year + month + day} - ${
        reportData.customerInfo.jobNumber
      } - ${reportData.customerInfo.reportType} Inspection Report`;

      message.innerHTML =
        "Uploading report to your Google Drive. Please wait...";

      pdfMake.createPdf(docDef).getBase64(async (base64Data) => {
        const response = await fetch(`${BASE_URL}?type=savepdf`, {
          method: "POST",
          body: JSON.stringify({
            folderName: newFolderName,
            base64Pdf: base64Data,
            customerInfo: reportData.customerInfo,
            tempFolder: folderid,
          }),
        });

        if (response.ok) {
          const pdf = await response.json();
          message.innerHTML = `<span>Report Generated Successfully</span><br>
          <a href="${pdf.docUrl}" target="_blank">${pdf.docUrl}</a><br>
          <span>Please refresh the page to generate new report</span>
          `;
          message.style.color = "green";

          const btn = document.getElementById("submitBtn");
          btn.disabled = true;
          btn.classList.add("disabled");

          document.getElementById("itemMessage").innerHTML = "";
          document.getElementById("secondMessage").innerHTML = "";
          loader.style.display = "none";
        }
      });
    } catch (err) {
      console.log(err);
      message.innerHTML =
        "Something went wrong. Please refresh the page and try again";
      message.style.color = "red";
      loader.style.display = "none";
    }
  });
});

const getLibraryItem = async (jsonFileName) => {
  try {
    const response = await fetch(`/items/${jsonFileName}`);
    if (response.ok) {
      const libraryItem = await response.json();
      return libraryItem;
    }
    return false;
  } catch (err) {
    console.log(err);
    return false;
  }
};

const getItemImagesDef = (itemImages) => {
  const imgStack = [];

  const imgCol = {
    columns: [],
    marginTop: 5,
    marginBottom: 5,
  };

  for (let k = 0; k < itemImages.length; k++) {
    if (k === itemImages.length - 1 && itemImages.length % 2 !== 0) {
      imgStack.push({
        image: itemImages[k],
        width: 220,
        height: 200,
        alignment: "center",
        marginBottom: 5,
      });
      break;
    }

    imgCol.columns.push({
      image: itemImages[k],
      width: 220,
      height: 200,
    });

    if (k % 2 !== 0) {
      imgStack.push({ ...imgCol });
      imgCol.columns = [];
    }
  }

  return imgStack;
};

const getCustomerInfoDocDef = (customerInfo) => {
  const inspectionDate = new Date(customerInfo.inspectionDate);
  const inspectionDateString = `${
    WEEKDAYS[inspectionDate.getDay()]
  } ${inspectionDate.getDate()}th ${
    MONTHS[inspectionDate.getMonth()]
  } ${inspectionDate.getFullYear()}`;

  const reportGenDate = new Date();
  const reportGenDateString = `${
    WEEKDAYS[reportGenDate.getDay()]
  } ${reportGenDate.getDate()}th ${
    MONTHS[reportGenDate.getMonth()]
  } ${reportGenDate.getFullYear()}`;

  return [
    {
      text: `${customerInfo.reportType}\nINSPECTION REPORT\n& DEFECTS LIST`,
      alignment: "right",
      fontSize: 33,
      marginBottom: 10,
      marginTop: 50,
      color: "#002060",
    },
    {
      text: customerInfo.siteAddress,
      alignment: "right",
      fontSize: 18,
      color: "#404040",
    },
    {
      pageBreak: "before",
      toc: {
        title: {
          stack: [
            {
              canvas: [
                {
                  type: "rect",
                  x: 0,
                  y: 0,
                  w: 495,
                  h: 20,
                  color: "#002060",
                },
              ],
            },
            {
              text: "Table Of Contents",
              style: "headingText",
            },
          ],
          style: "heading",
        },
      },
    },
    {
      pageBreak: "before",
      stack: [
        {
          stack: [
            {
              canvas: [
                {
                  type: "rect",
                  x: 0,
                  y: 0,
                  w: 495,
                  h: 20,
                  color: "#002060",
                },
              ],
            },
            {
              tocItem: true,
              text: "Client & Property Details",
              style: "headingText",
            },
          ],
          style: "heading",
        },
        {
          text: [
            {
              text: "Client Name(s):      ",
              style: "propertyName",
            },
            {
              text: customerInfo.customerName,
            },
          ],
          style: "detailSmall",
        },
        {
          text: [
            {
              text: "Subject Property:      ",
              style: "propertyName",
            },
            {
              text: customerInfo.siteAddress,
            },
          ],
          style: "detailSmall",
        },
      ],
      style: "detailStack",
    },
    {
      stack: [
        {
          stack: [
            {
              canvas: [
                {
                  type: "rect",
                  x: 0,
                  y: 0,
                  w: 495,
                  h: 20,
                  color: "#002060",
                },
              ],
            },
            {
              tocItem: true,
              text: "Inspection & Report Details",
              style: "headingText",
            },
          ],
          style: "heading",
        },
        {
          text: [
            {
              text: "Inspection Date:      ",
              style: "propertyName",
            },
            {
              text: inspectionDateString,
            },
          ],
          style: "detailSmall",
        },
        {
          text: [
            {
              text: "Inspection Time:      ",
              style: "propertyName",
            },
            {
              text: timeTo12Hours(customerInfo.inspectionTime),
            },
          ],
          style: "detailSmall",
        },
        {
          text: [
            {
              text: "Stage of Works:      ",
              style: "propertyName",
            },
            {
              text: getStage(customerInfo.reportType),
            },
          ],
          style: "detailSmall",
        },
        {
          text: [
            {
              text: "Date of this Report:      ",
              style: "propertyName",
            },
            {
              text: reportGenDateString,
            },
          ],
          style: "detailSmall",
        },
      ],
      style: "detailStack",
    },
  ];
};

const getInspectionNotesDef = (inspectionNotes) => {
  const inspectionNotesString = inspectionNotes
    .map((note, index) => `${index + 1}. ${note}`)
    .join("\n");

  return {
    stack: [
      {
        stack: [
          {
            canvas: [
              {
                type: "rect",
                x: 0,
                y: 0,
                w: 495,
                h: 20,
                color: "#002060",
              },
            ],
          },
          {
            tocItem: true,
            text: "Inspection Notes",
            style: "headingText",
          },
        ],
        style: "heading",
      },
      {
        text: `At the time of this inspection, we note the following;\n${inspectionNotesString}`,
        style: "normalText",
      },
    ],
    style: "detailStack",
  };
};

const getGeneralAndPurposDef = () => {
  return [
    {
      stack: [
        {
          stack: [
            {
              canvas: [
                {
                  type: "rect",
                  x: 0,
                  y: 0,
                  w: 495,
                  h: 20,
                  color: "#002060",
                },
              ],
            },
            {
              tocItem: true,
              text: "Report Purpose",
              style: "headingText",
            },
          ],
          style: "heading",
        },
        {
          text: `The purpose of this inspection and report is to check on the progress of works and quality of workmanship at the specified construction stage and to identify defects or faults in the new construction that do not reach an acceptable standard of quality, or have not been built in a proper workmanlike manner in relation to the Building Act & Regulations, the National Construction Code's Building Code of Australia (BCA), any relevant Australian Standard, any manufacturers installation instruction or the acceptable standards & tolerances as set down by the Victorian Building Authority (VBA). The results of this inspection are in the Schedule of Building Defects table section.`,
          style: "normalText",
        },
      ],
      style: "detailStack",
    },
    {
      stack: [
        {
          stack: [
            {
              canvas: [
                {
                  type: "rect",
                  x: 0,
                  y: 0,
                  w: 495,
                  h: 20,
                  color: "#002060",
                },
              ],
            },
            {
              tocItem: true,
              text: "General",
              style: "headingText",
            },
          ],
          style: "heading",
        },
        {
          text: `This report is the result of a visual inspection only and is intended to provide a reasonable confirmation of the progress and quality of the works to date and to note items that may need attention by the builder to ensure satisfactory quality of workmanship. This report is not to be read as an instruction to the builder. Should the reader of this report have any questions in relation to the items set out within it, please do not hesitate to contact our office.`,
          style: "normalText",
        },
      ],
      style: "detailStack",
    },
  ];
};

const getAllFolderNames = async () => {
  try {
    const response = await fetch(`${BASE_URL}?type=allfolders`);
    if (response.ok) {
      const folderNames = await response.json();
      return folderNames;
    }
    return false;
  } catch (err) {
    console.log(err);
    return false;
  }
};

const getReportData = async (folderid) => {
  try {
    const response = await fetch(
      `${BASE_URL}?type=reportdata&folderid=${folderid}`
    );
    if (response.ok) {
      const reportData = await response.json();
      return reportData;
    }
    return false;
  } catch (err) {
    console.log(err);
    return false;
  }
};

const getItemData = async (fileid) => {
  try {
    const response = await fetch(`${BASE_URL}?type=itemdata&fileid=${fileid}`);
    if (response.ok) {
      const itemData = await response.json();
      return itemData;
    }
    return false;
  } catch (err) {
    console.log(err);
    return false;
  }
};

const timeTo12Hours = (time24) => {
  let hours12;
  let period = "";
  const [hours, minutes] = time24.split(":").map(Number);
  if (hours === 0) {
    hours12 = "12";
    period = "AM";
  } else if (hours === 12) {
    hours12 = "12";
    period = "PM";
  } else if (hours > 12) {
    hours12 = (hours % 12).toString();
    period = "PM";
  } else {
    hours12 = hours.toString();
    period = "AM";
  }
  const time12 = `${getFormatDateValue(hours12)}:${getFormatDateValue(
    minutes.toString()
  )} ${period}`;
  return time12;
};

const getFormatDateValue = (str) => {
  return str.length === 2 ? str : "0" + str;
};

const getStage = (type) => {
  const stage = {
    "PRE-SLAB": "Prior to concrete slab pour.",
    "POST-SLAB": "After concrete slab pour.",
    FRAME: "Approaching frame stage.",
    "PRE-PLASTER": "Approaching lock-up stage.",
    FIXING: "Approaching fixing stage.",
    WATERPROOFING: "Approaching fixing stage.",
    HANDOVER: "Approaching completion.",
    MAINTENANCE: "Maintenance/Warranty stage.",
    REINSPECTION: "Reinspection of previous report.",
  };

  return stage[type];
};

const getResponsibilityAndTermsDef = () => {
  return [
    {
      pageBreak: "before",
      stack: [
        {
          stack: [
            {
              canvas: [
                {
                  type: "rect",
                  x: 0,
                  y: 0,
                  w: 495,
                  h: 20,
                  color: "#002060",
                },
              ],
            },
            {
              text: `Builder’s Responsibility To Rectify`,
              style: "headingText",
            },
          ],
          style: "heading",
        },
        {
          tocItem: true,
          text: "Your Building Contract;",
          style: "itemName",
        },
        {
          text: `This report is the result of a visual inspection only and is intended to provide a reasonable confirmation of the progress and quality of the works to date and to note items that may need attention by the builder to ensure satisfactory quality of workmanship. This report is not to be read as an instruction to the builder. Should the reader of this report have any questions in relation to the items set out within it, please do not hesitate to contact our office.`,
          style: "normalText",
        },
        {
          text: "The Building Surveyor’s Role;",
          style: "itemName",
        },
        {
          text: `Your builder may try to represent to you that because the building surveyor has approved a stage of works then they do not need to address any additional items identified within this report, however this is not true. The building surveyor only operates under and ensures compliance with the Building Act, not the Domestic Building Contracts Act or your building contract, to which they are not party to. Any such representation would only be from someone that is either ill-informed or attempting to mislead you!\n\nWhile the building surveyor does play a regulatory role in the process of your new homes construction, they are not the final advocate on its quality or its compliance with your building contract or the Domestic Building Contracts Act.\n\nYou should note that on completion of the construction of your home, the building surveyor will issue an Occupancy Permit, however what most people are never made aware of is that Section 46 Effects of Occupancy Permits of the Building Act clearly states that An Occupancy permit is not evidence that the building or part of a building to which it applies complies with this Act or the Building Regulations. As a result, there is very little protection for you from the surveyor, other than knowing your home complies with the minimum regulatory requirements of the Building Act.\n\nNowhere in the Building Act does it state that a surveyors approval overrides compliance with the Domestic Building Contracts Act, and vice-versa. Therefore, your builder has a regulatory obligation to comply with the Building Act and a contractual obligation to comply with the Domestic Building Contracts Act.
          `,
          style: "normalText",
        },
        {
          text: "Completion & Final Payment;",
          style: "itemName",
        },
        {
          text: `For your builder to have reached the completion stage of your home, at which point they are entitled to receive their final payment, they must have completed all of their requirements under the Building Act and provided you with a copy of the Occupancy Permit. They must also have completed your home in a proper and workmanlike manner and in accordance with the plans and specifications; and all work performed by them must also have been carried out with reasonable care and skill.\n\nIt should be noted that until your builder has achieved full compliance with these warranties then the works remain incomplete, and the builder would not be entitled to receive final payment. The outstanding and newly identified items documented in the schedules below must be properly addressed by your builder for your home to reach completion.
          `,
          style: "normalText",
        },
      ],
      style: "detailStack",
    },
    {
      pageBreak: "before",
      stack: [
        {
          stack: [
            {
              canvas: [
                {
                  type: "rect",
                  x: 0,
                  y: 0,
                  w: 495,
                  h: 20,
                  color: "#002060",
                },
              ],
            },
            {
              tocItem: true,
              text: `Terms & Conditions for the Provision of this Report`,
              style: "headingText",
            },
          ],
          style: "heading",
        },
        {
          text: `1. The Report is expressly produced for the sole use of the Client. Legal liability is limited to the Client.
          2. No advice is given regarding the presence, or effect, of termites on the Property. A specialist company should be approached to provide such certification if required.
          3. Any dimensions given are approximate only. Should any dimensions be considered critical or important, they should be accurately measured.
          4. The Client acknowledges, and agrees that any comments contained in the Report relating to matters of an electrical or plumbing nature are based on a visual inspection only carried out by the Inspector on the day of the inspection, and should not in any way be relied upon by the Client as a substitute for obtaining expert professional advice from a licensed electrician or plumber.
          5. Any charge-out rate quoted relates to normal work and is not applicable for work relating to arbitration, mediation, conciliation, expert witness, court appearance, document preparation, or any other legal application.
          6. The Report comments on only those features that were reasonably visible and reasonably accessible at the time of the inspection, without recourse to viewing platforms, the removal, or moving of building components, or any other materials of any kind or any other unusual methodology.
          7. We have not inspected the structure/frame/foundation/drains etc. that are covered, unexposed or inaccessible, and are therefore unable to report that any such part of the structure is free from defect.
          8. Only those items in the Report that have been commented upon have been inspected. If there is no comment against an item, it has not been inspected. The Inspector gives no undertaking that they will inspect all items present on the day of the inspection.
          9. This report, its layout and contents are the copyright of Correct Inspections. Any person, party or entity, other than the party named as the client on this report hereof that uses or relies upon this report without our expressed written permission is in breach of this copyright.
          10. All advice given by the Inspector and not included in the Report is given in good faith. However, no responsibility is accepted for any losses, either direct or consequential, resulting from the advice.
          11. The Report is confirmation of a visual inspection of the Property carried out by the Inspector on the day of the inspection and only covers those items that could reasonably be detected by such visual inspection at the time of such inspection.
          12. All statutory or implied conditions and warranties are excluded to the extent permitted by law.
          13. To the extent permitted by law, liability under any condition or warranty that cannot legally be excluded, is limited to supplying the Report again, or paying the cost of having the Report supplied again.
          14. If the Report fails to conform in any material respect to the terms and conditions set out herein, then the Inspector is not liable unless the Client notifies the Inspector of the failure within 28 days after the date of delivery of the Report, and the liability of the Inspector is, in any case, limited to the cost of providing this inspection, and the Inspector is not liable for any consequential damage.
          15. The provisions of clause 14 above are subject to the provision of any statutory condition or warranty that cannot legally be excluded.
          16. Payment to the Inspector will be made at the time of inspection or prior to the supply of the report.
          17. The terms and conditions contained herein constitute the entire agreement and understanding between the Client and the Inspector, on everything connected to the subject matter of the Agreement, and supersede any prior agreement or understanding or anything connected with that subject matter.
          18. These are the standard terms and conditions under which we provide our service to you. When we provide you our service, we do so on the basis that these terms and conditions make up the terms of the contract between you and us, and you agree to be bound by these terms and conditions.
          19. This Report is not intended to be used for the purposes of VCAT, or similar civil arenas, and You agree that We reserve the right to decline the invitation to present this report as evidence in any civil matter.
          20. If you do not agree to be bound by these terms and conditions, then you must contact us prior to us providing you our service to advise us that you do not want to make a contract with us, and do not want us to provide our service to you
          `,
        },
      ],
      style: "detailStack",
    },
  ];
};
