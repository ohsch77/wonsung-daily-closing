import {
  createHash,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


const MAX_EXCEL_FILE_SIZE =
  15 * 1024 * 1024;


const CFB_SIGNATURE =
  Buffer.from([
    0xd0,
    0xcf,
    0x11,
    0xe0,
    0xa1,
    0xb1,
    0x1a,
    0xe1,
  ]);


const FREE_SECTOR =
  0xffffffff;

const END_OF_CHAIN =
  0xfffffffe;

const NO_STREAM =
  0xffffffff;


const RECORD_BOF =
  0x0809;

const RECORD_FILEPASS =
  0x002f;

const RECORD_BOUNDSHEET8 =
  0x0085;

const RECORD_INTERFACE_HDR =
  0x00e1;

const RECORD_RRD_HEAD =
  0x0138;

const RECORD_USR_EXCL =
  0x0194;

const RECORD_FILE_LOCK =
  0x0195;

const RECORD_RRD_INFO =
  0x0196;


const RC4_BLOCK_SIZE =
  1024;


class InvalidPasswordError extends Error {
  constructor() {
    super(
      "The password is incorrect"
    );

    this.name =
      "InvalidPasswordError";
  }
}


class UnsupportedEncryptionError extends Error {
  constructor(
    message =
      "Unsupported Excel encryption"
  ) {
    super(message);

    this.name =
      "UnsupportedEncryptionError";
  }
}


type DirectoryEntry = {
  name: string;
  type: number;
  startSector: number;
  size: number;
};


type CfbContext = {
  source: Buffer;
  sectorSize: number;
  miniSectorSize: number;
  miniStreamCutoff: number;
  fat: number[];
  miniFat: number[];
  directoryEntries:
    DirectoryEntry[];
};


type OfficeCryptoModule = {
  decrypt: (
    input: Buffer,
    options: {
      password: string;
    }
  ) => Promise<Buffer | Uint8Array>;
};


function jsonError(
  code: string,
  status: number
) {
  return NextResponse.json(
    {
      ok: false,
      code,
    },
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    }
  );
}


function isCfbFile(
  input: Buffer
) {
  return (
    input.length >=
      CFB_SIGNATURE.length &&
    input
      .subarray(
        0,
        CFB_SIGNATURE.length
      )
      .equals(
        CFB_SIGNATURE
      )
  );
}


function readUInt64LEAsNumber(
  buffer: Buffer,
  offset: number
) {
  const low =
    buffer.readUInt32LE(
      offset
    );

  const high =
    buffer.readUInt32LE(
      offset + 4
    );

  const value =
    high * 0x100000000 +
    low;

  if (
    !Number.isSafeInteger(
      value
    )
  ) {
    throw new Error(
      "CFB stream size is too large."
    );
  }

  return value;
}


function getSectorOffset(
  sectorId: number,
  sectorSize: number
) {
  return (
    512 +
    sectorId * sectorSize
  );
}


function getSector(
  source: Buffer,
  sectorId: number,
  sectorSize: number
) {
  const offset =
    getSectorOffset(
      sectorId,
      sectorSize
    );

  const end =
    offset +
    sectorSize;

  if (
    sectorId < 0 ||
    offset < 512 ||
    end > source.length
  ) {
    throw new Error(
      "Invalid CFB sector."
    );
  }

  return source.subarray(
    offset,
    end
  );
}


function readSectorIdArray(
  buffer: Buffer
) {
  const result:
    number[] = [];

  for (
    let offset = 0;
    offset + 4 <=
      buffer.length;
    offset += 4
  ) {
    result.push(
      buffer.readUInt32LE(
        offset
      )
    );
  }

  return result;
}


function buildChain(
  startSector: number,
  table: number[]
) {
  const result:
    number[] = [];

  const seen =
    new Set<number>();

  let sectorId =
    startSector;


  while (
    sectorId !==
      END_OF_CHAIN &&
    sectorId !==
      FREE_SECTOR &&
    sectorId !==
      NO_STREAM
  ) {
    if (
      !Number.isInteger(
        sectorId
      ) ||
      sectorId < 0 ||
      sectorId >=
        table.length
    ) {
      throw new Error(
        "Invalid CFB chain."
      );
    }


    if (
      seen.has(
        sectorId
      )
    ) {
      throw new Error(
        "Circular CFB chain."
      );
    }


    seen.add(
      sectorId
    );

    result.push(
      sectorId
    );

    sectorId =
      table[
        sectorId
      ];
  }


  return result;
}


function readRegularStream(
  source: Buffer,
  startSector: number,
  size: number,
  fat: number[],
  sectorSize: number
) {
  if (
    size === 0
  ) {
    return Buffer.alloc(0);
  }


  const chain =
    buildChain(
      startSector,
      fat
    );


  const chunks =
    chain.map(
      (sectorId) =>
        getSector(
          source,
          sectorId,
          sectorSize
        )
    );


  return Buffer.concat(
    chunks
  ).subarray(
    0,
    size
  );
}


function parseCfb(
  source: Buffer
): CfbContext {
  if (
    !isCfbFile(
      source
    )
  ) {
    throw new Error(
      "Not a CFB Excel file."
    );
  }


  const majorVersion =
    source.readUInt16LE(
      26
    );

  const sectorShift =
    source.readUInt16LE(
      30
    );

  const miniSectorShift =
    source.readUInt16LE(
      32
    );


  const sectorSize =
    1 << sectorShift;

  const miniSectorSize =
    1 << miniSectorShift;


  if (
    ![
      3,
      4,
    ].includes(
      majorVersion
    ) ||
    ![
      512,
      4096,
    ].includes(
      sectorSize
    ) ||
    miniSectorSize !==
      64
  ) {
    throw new Error(
      "Unsupported CFB layout."
    );
  }


  const numberOfFatSectors =
    source.readUInt32LE(
      44
    );

  const firstDirectorySector =
    source.readUInt32LE(
      48
    );

  const miniStreamCutoff =
    source.readUInt32LE(
      56
    );

  const firstMiniFatSector =
    source.readUInt32LE(
      60
    );

  const numberOfMiniFatSectors =
    source.readUInt32LE(
      64
    );

  const firstDifatSector =
    source.readUInt32LE(
      68
    );

  const numberOfDifatSectors =
    source.readUInt32LE(
      72
    );


  const difat:
    number[] = [];


  for (
    let index = 0;
    index < 109;
    index += 1
  ) {
    const sectorId =
      source.readUInt32LE(
        76 +
        index * 4
      );

    if (
      sectorId !==
        FREE_SECTOR
    ) {
      difat.push(
        sectorId
      );
    }
  }


  let currentDifatSector =
    firstDifatSector;


  for (
    let index = 0;
    index <
      numberOfDifatSectors;
    index += 1
  ) {
    if (
      currentDifatSector ===
        END_OF_CHAIN ||
      currentDifatSector ===
        FREE_SECTOR
    ) {
      break;
    }


    const sector =
      getSector(
        source,
        currentDifatSector,
        sectorSize
      );


    const entryCount =
      sectorSize / 4 -
      1;


    for (
      let entry = 0;
      entry <
        entryCount;
      entry += 1
    ) {
      const sectorId =
        sector.readUInt32LE(
          entry * 4
        );

      if (
        sectorId !==
          FREE_SECTOR
      ) {
        difat.push(
          sectorId
        );
      }
    }


    currentDifatSector =
      sector.readUInt32LE(
        sectorSize - 4
      );
  }


  const fat:
    number[] = [];


  for (
    const fatSectorId of
      difat.slice(
        0,
        numberOfFatSectors
      )
  ) {
    fat.push(
      ...readSectorIdArray(
        getSector(
          source,
          fatSectorId,
          sectorSize
        )
      )
    );
  }


  const directoryChain =
    buildChain(
      firstDirectorySector,
      fat
    );


  const directoryStream =
    Buffer.concat(
      directoryChain.map(
        (sectorId) =>
          getSector(
            source,
            sectorId,
            sectorSize
          )
      )
    );


  const directoryEntries:
    DirectoryEntry[] = [];


  for (
    let offset = 0;
    offset + 128 <=
      directoryStream.length;
    offset += 128
  ) {
    const entry =
      directoryStream.subarray(
        offset,
        offset + 128
      );


    const nameLength =
      entry.readUInt16LE(
        64
      );


    let name = "";


    if (
      nameLength >= 2 &&
      nameLength <= 64
    ) {
      name =
        entry
          .subarray(
            0,
            nameLength - 2
          )
          .toString(
            "utf16le"
          );
    }


    const type =
      entry.readUInt8(
        66
      );

    const startSector =
      entry.readUInt32LE(
        116
      );

    const size =
      majorVersion === 3
        ? entry.readUInt32LE(
            120
          )
        : readUInt64LEAsNumber(
            entry,
            120
          );


    directoryEntries.push({
      name,
      type,
      startSector,
      size,
    });
  }


  const miniFat:
    number[] = [];


  if (
    numberOfMiniFatSectors >
      0 &&
    firstMiniFatSector !==
      END_OF_CHAIN &&
    firstMiniFatSector !==
      FREE_SECTOR
  ) {
    const miniFatChain =
      buildChain(
        firstMiniFatSector,
        fat
      ).slice(
        0,
        numberOfMiniFatSectors
      );


    for (
      const sectorId of
        miniFatChain
    ) {
      miniFat.push(
        ...readSectorIdArray(
          getSector(
            source,
            sectorId,
            sectorSize
          )
        )
      );
    }
  }


  return {
    source,
    sectorSize,
    miniSectorSize,
    miniStreamCutoff,
    fat,
    miniFat,
    directoryEntries,
  };
}


function getDirectoryEntry(
  context: CfbContext,
  names: string[]
) {
  const normalized =
    new Set(
      names.map(
        (name) =>
          name.toLowerCase()
      )
    );


  return context.directoryEntries.find(
    (entry) =>
      entry.type === 2 &&
      normalized.has(
        entry.name.toLowerCase()
      )
  );
}


function getRootEntry(
  context: CfbContext
) {
  return context.directoryEntries.find(
    (entry) =>
      entry.type === 5
  );
}


function readMiniStream(
  context: CfbContext,
  entry: DirectoryEntry
) {
  const root =
    getRootEntry(
      context
    );


  if (
    !root ||
    root.size === 0 ||
    context.miniFat.length ===
      0
  ) {
    throw new Error(
      "Mini stream is unavailable."
    );
  }


  const rootMiniStream =
    readRegularStream(
      context.source,
      root.startSector,
      root.size,
      context.fat,
      context.sectorSize
    );


  const miniChain =
    buildChain(
      entry.startSector,
      context.miniFat
    );


  const chunks =
    miniChain.map(
      (miniSectorId) => {
        const start =
          miniSectorId *
          context.miniSectorSize;

        const end =
          start +
          context.miniSectorSize;

        if (
          start < 0 ||
          end >
            rootMiniStream.length
        ) {
          throw new Error(
            "Invalid mini stream sector."
          );
        }

        return rootMiniStream.subarray(
          start,
          end
        );
      }
    );


  return Buffer.concat(
    chunks
  ).subarray(
    0,
    entry.size
  );
}


function readEntryStream(
  context: CfbContext,
  entry: DirectoryEntry
) {
  if (
    entry.size <
      context.miniStreamCutoff
  ) {
    return readMiniStream(
      context,
      entry
    );
  }


  return readRegularStream(
    context.source,
    entry.startSector,
    entry.size,
    context.fat,
    context.sectorSize
  );
}


function writeRegularStream(
  output: Buffer,
  context: CfbContext,
  entry: DirectoryEntry,
  stream: Buffer
) {
  const chain =
    buildChain(
      entry.startSector,
      context.fat
    );


  let sourceOffset =
    0;


  for (
    const sectorId of
      chain
  ) {
    if (
      sourceOffset >=
      stream.length
    ) {
      break;
    }


    const destinationOffset =
      getSectorOffset(
        sectorId,
        context.sectorSize
      );


    const length =
      Math.min(
        context.sectorSize,
        stream.length -
          sourceOffset
      );


    stream.copy(
      output,
      destinationOffset,
      sourceOffset,
      sourceOffset +
        length
    );


    sourceOffset +=
      length;
  }


  if (
    sourceOffset <
    stream.length
  ) {
    throw new Error(
      "CFB stream chain is too short."
    );
  }
}


function writeMiniStream(
  output: Buffer,
  context: CfbContext,
  entry: DirectoryEntry,
  stream: Buffer
) {
  const root =
    getRootEntry(
      context
    );


  if (
    !root ||
    context.miniFat.length ===
      0
  ) {
    throw new Error(
      "Mini stream is unavailable."
    );
  }


  const rootMiniStream =
    Buffer.from(
      readRegularStream(
        output,
        root.startSector,
        root.size,
        context.fat,
        context.sectorSize
      )
    );


  const miniChain =
    buildChain(
      entry.startSector,
      context.miniFat
    );


  let sourceOffset =
    0;


  for (
    const miniSectorId of
      miniChain
  ) {
    if (
      sourceOffset >=
      stream.length
    ) {
      break;
    }


    const destinationOffset =
      miniSectorId *
      context.miniSectorSize;


    const length =
      Math.min(
        context.miniSectorSize,
        stream.length -
          sourceOffset
      );


    stream.copy(
      rootMiniStream,
      destinationOffset,
      sourceOffset,
      sourceOffset +
        length
    );


    sourceOffset +=
      length;
  }


  if (
    sourceOffset <
    stream.length
  ) {
    throw new Error(
      "Mini stream chain is too short."
    );
  }


  writeRegularStream(
    output,
    context,
    root,
    rootMiniStream
  );
}


function writeEntryStream(
  output: Buffer,
  context: CfbContext,
  entry: DirectoryEntry,
  stream: Buffer
) {
  if (
    stream.length !==
    entry.size
  ) {
    throw new Error(
      "The decrypted Workbook stream size changed unexpectedly."
    );
  }


  if (
    entry.size <
      context.miniStreamCutoff
  ) {
    writeMiniStream(
      output,
      context,
      entry,
      stream
    );

    return;
  }


  writeRegularStream(
    output,
    context,
    entry,
    stream
  );
}


function md5(
  input: Buffer
) {
  return createHash(
    "md5"
  )
    .update(input)
    .digest();
}


function deriveRc4Key(
  password: string,
  salt: Buffer,
  block: number
) {
  const passwordBytes =
    Buffer.from(
      password,
      "utf16le"
    );


  const passwordHash =
    md5(
      passwordBytes
    );


  const truncatedHash =
    passwordHash.subarray(
      0,
      5
    );


  const intermediatePart =
    Buffer.concat([
      truncatedHash,
      salt,
    ]);


  const intermediate =
    md5(
      Buffer.concat(
        Array.from(
          {
            length: 16,
          },
          () =>
            intermediatePart
        )
      )
    );


  const blockBytes =
    Buffer.alloc(4);


  blockBytes.writeUInt32LE(
    block,
    0
  );


  return md5(
    Buffer.concat([
      intermediate.subarray(
        0,
        5
      ),
      blockBytes,
    ])
  );
}


function rc4Crypt(
  key: Buffer,
  input: Buffer
) {
  const state =
    Array.from(
      {
        length: 256,
      },
      (
        _value,
        index
      ) => index
    );


  let j = 0;


  for (
    let i = 0;
    i < 256;
    i += 1
  ) {
    j =
      (
        j +
        state[i] +
        key[
          i % key.length
        ]
      ) &
      0xff;


    const temporary =
      state[i];

    state[i] =
      state[j];

    state[j] =
      temporary;
  }


  const output =
    Buffer.alloc(
      input.length
    );


  let i = 0;

  j = 0;


  for (
    let offset = 0;
    offset <
      input.length;
    offset += 1
  ) {
    i =
      (i + 1) &
      0xff;

    j =
      (
        j +
        state[i]
      ) &
      0xff;


    const temporary =
      state[i];

    state[i] =
      state[j];

    state[j] =
      temporary;


    const keyByte =
      state[
        (
          state[i] +
          state[j]
        ) &
          0xff
      ];


    output[offset] =
      input[offset] ^
      keyByte;
  }


  return output;
}


function verifyStandardRc4Password(
  password: string,
  salt: Buffer,
  encryptedVerifier: Buffer,
  encryptedVerifierHash: Buffer
) {
  const key =
    deriveRc4Key(
      password,
      salt,
      0
    );


  const decrypted =
    rc4Crypt(
      key,
      Buffer.concat([
        encryptedVerifier,
        encryptedVerifierHash,
      ])
    );


  const verifier =
    decrypted.subarray(
      0,
      16
    );

  const verifierHash =
    decrypted.subarray(
      16,
      32
    );


  return verifierHash.equals(
    md5(
      verifier
    )
  );
}


function createRc4KeyStream(
  password: string,
  salt: Buffer,
  block: number,
  length: number
) {
  return rc4Crypt(
    deriveRc4Key(
      password,
      salt,
      block
    ),
    Buffer.alloc(
      length
    )
  );
}


function decryptStandardRc4Workbook(
  workbook: Buffer,
  password: string
) {
  let filePassOffset =
    -1;

  let filePassSize =
    0;


  for (
    let offset = 0;
    offset + 4 <=
      workbook.length;
  ) {
    const recordId =
      workbook.readUInt16LE(
        offset
      );

    const recordSize =
      workbook.readUInt16LE(
        offset + 2
      );


    const recordEnd =
      offset +
      4 +
      recordSize;


    if (
      recordEnd >
      workbook.length
    ) {
      throw new Error(
        "Invalid BIFF record stream."
      );
    }


    if (
      recordId ===
      RECORD_FILEPASS
    ) {
      filePassOffset =
        offset;

      filePassSize =
        recordSize;

      break;
    }


    offset =
      recordEnd;
  }


  if (
    filePassOffset < 0
  ) {
    return Buffer.from(
      workbook
    );
  }


  if (
    filePassSize < 54
  ) {
    throw new UnsupportedEncryptionError();
  }


  const payloadOffset =
    filePassOffset + 4;


  const encryptionType =
    workbook.readUInt16LE(
      payloadOffset
    );

  const major =
    workbook.readUInt16LE(
      payloadOffset + 2
    );

  const minor =
    workbook.readUInt16LE(
      payloadOffset + 4
    );


  if (
    encryptionType !==
      0x0001 ||
    major !==
      0x0001 ||
    minor !==
      0x0001
  ) {
    throw new UnsupportedEncryptionError(
      "This XLS file is not Standard RC4 1.1."
    );
  }


  const salt =
    workbook.subarray(
      payloadOffset + 6,
      payloadOffset + 22
    );

  const encryptedVerifier =
    workbook.subarray(
      payloadOffset + 22,
      payloadOffset + 38
    );

  const encryptedVerifierHash =
    workbook.subarray(
      payloadOffset + 38,
      payloadOffset + 54
    );


  if (
    !verifyStandardRc4Password(
      password,
      salt,
      encryptedVerifier,
      encryptedVerifierHash
    )
  ) {
    throw new InvalidPasswordError();
  }


  const output =
    Buffer.from(
      workbook
    );


  const keyStreams =
    new Map<
      number,
      Buffer
    >();


  const getKeyByte =
    (position: number) => {
      const block =
        Math.floor(
          position /
          RC4_BLOCK_SIZE
        );

      const index =
        position %
        RC4_BLOCK_SIZE;


      let keyStream =
        keyStreams.get(
          block
        );


      if (
        !keyStream
      ) {
        keyStream =
          createRc4KeyStream(
            password,
            salt,
            block,
            RC4_BLOCK_SIZE
          );

        keyStreams.set(
          block,
          keyStream
        );
      }


      return keyStream[
        index
      ];
    };


  const fullyUnencryptedRecords =
    new Set([
      RECORD_BOF,
      RECORD_FILEPASS,
      RECORD_INTERFACE_HDR,
      RECORD_RRD_HEAD,
      RECORD_USR_EXCL,
      RECORD_FILE_LOCK,
      RECORD_RRD_INFO,
    ]);


  for (
    let offset = 0;
    offset + 4 <=
      workbook.length;
  ) {
    const recordId =
      workbook.readUInt16LE(
        offset
      );

    const recordSize =
      workbook.readUInt16LE(
        offset + 2
      );


    const dataStart =
      offset + 4;

    const recordEnd =
      dataStart +
      recordSize;


    if (
      recordEnd >
      workbook.length
    ) {
      throw new Error(
        "Invalid BIFF record stream."
      );
    }


    if (
      recordId ===
      RECORD_FILEPASS
    ) {
      output.writeUInt16LE(
        0x0000,
        offset
      );

      output.fill(
        0,
        dataStart,
        recordEnd
      );
    }
    else if (
      !fullyUnencryptedRecords.has(
        recordId
      )
    ) {
      const encryptedStart =
        recordId ===
          RECORD_BOUNDSHEET8
          ? Math.min(
              dataStart + 4,
              recordEnd
            )
          : dataStart;


      for (
        let position =
          encryptedStart;
        position <
          recordEnd;
        position += 1
      ) {
        output[position] =
          workbook[position] ^
          getKeyByte(
            position
          );
      }
    }


    offset =
      recordEnd;
  }


  return output;
}


function decryptLegacyXlsStandardRc4(
  input: Buffer,
  password: string
) {
  const context =
    parseCfb(
      input
    );


  const workbookEntry =
    getDirectoryEntry(
      context,
      [
        "Workbook",
        "Book",
      ]
    );


  if (
    !workbookEntry
  ) {
    throw new UnsupportedEncryptionError(
      "Workbook stream was not found."
    );
  }


  const workbook =
    readEntryStream(
      context,
      workbookEntry
    );


  const decryptedWorkbook =
    decryptStandardRc4Workbook(
      workbook,
      password
    );


  const output =
    Buffer.from(
      input
    );


  writeEntryStream(
    output,
    context,
    workbookEntry,
    decryptedWorkbook
  );


  return output;
}


async function fallbackOfficeCryptoDecrypt(
  input: Buffer,
  password: string
) {
  const imported =
    await import(
      "officecrypto-tool"
    );


  const officeCrypto =
    (
      "default" in imported
        ? imported.default
        : imported
    ) as OfficeCryptoModule;


  if (
    typeof officeCrypto.decrypt !==
    "function"
  ) {
    throw new UnsupportedEncryptionError();
  }


  const result =
    await officeCrypto.decrypt(
      input,
      {
        password,
      }
    );


  return Buffer.isBuffer(
    result
  )
    ? result
    : Buffer.from(
        result
      );
}


export async function POST(
  request: Request
) {
  try {
    const formData =
      await request.formData();


    const fileValue =
      formData.get(
        "file"
      );

    const passwordValue =
      formData.get(
        "password"
      );


    if (
      !(fileValue instanceof File)
    ) {
      return jsonError(
        "FILE_REQUIRED",
        400
      );
    }


    if (
      typeof passwordValue !==
        "string" ||
      passwordValue.length ===
        0
    ) {
      return jsonError(
        "PASSWORD_REQUIRED",
        400
      );
    }


    if (
      fileValue.size === 0 ||
      fileValue.size >
        MAX_EXCEL_FILE_SIZE
    ) {
      return jsonError(
        "INVALID_FILE_SIZE",
        400
      );
    }


    const extension =
      fileValue.name
        .split(".")
        .pop()
        ?.trim()
        .toLowerCase();


    if (
      extension !== "xls" &&
      extension !== "xlsx"
    ) {
      return jsonError(
        "INVALID_FILE_TYPE",
        400
      );
    }


    const inputBuffer =
      Buffer.from(
        await fileValue.arrayBuffer()
      );


    let decrypted:
      Buffer;


    try {
      if (
        extension === "xls" &&
        isCfbFile(
          inputBuffer
        )
      ) {
        try {
          decrypted =
            decryptLegacyXlsStandardRc4(
              inputBuffer,
              passwordValue
            );
        }
        catch (error) {
          if (
            error instanceof
            InvalidPasswordError
          ) {
            return jsonError(
              "INVALID_PASSWORD",
              422
            );
          }


          if (
            error instanceof
            UnsupportedEncryptionError
          ) {
            decrypted =
              await fallbackOfficeCryptoDecrypt(
                inputBuffer,
                passwordValue
              );
          }
          else {
            throw error;
          }
        }
      }
      else {
        decrypted =
          await fallbackOfficeCryptoDecrypt(
            inputBuffer,
            passwordValue
          );
      }
    }
    catch (error) {
      if (
        error instanceof
        InvalidPasswordError
      ) {
        return jsonError(
          "INVALID_PASSWORD",
          422
        );
      }


      const message =
        error instanceof Error
          ? error.message
          : "";


      if (
        /password.*incorrect|incorrect.*password/i.test(
          message
        )
      ) {
        return jsonError(
          "INVALID_PASSWORD",
          422
        );
      }


      return jsonError(
        "UNSUPPORTED_ENCRYPTION",
        422
      );
    }


    if (
      !decrypted ||
      decrypted.length === 0
    ) {
      return jsonError(
        "UNSUPPORTED_ENCRYPTION",
        422
      );
    }


    return new Response(
      new Uint8Array(
        decrypted
      ),
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/octet-stream",

          "Cache-Control":
            "no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );
  }
  catch {
    return jsonError(
      "DECRYPT_FAILED",
      500
    );
  }
}
