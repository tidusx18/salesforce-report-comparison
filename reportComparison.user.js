// ==UserScript==
// @name         Compare Course Records
// @namespace    http://github.com/redice44
// @version      0.0.1
// @description  Check for updated salesforce course records
// @author       Matt Thomson <mthomson.lee@gmail.com>
// @author       Daniel Victoriano <victoriano518@gmail.com>
// @match        https://fiuonline.lightning.force.com/lightning/r/Report/*
// @grant        none
// ==/UserScript==

/* MIT License */

( function() {


  const recordId = 'CLASS ID\n';
  const localStorageId = window.location.pathname.substr( 1 );
  const headerSelector = '.headerRow .sortHeader';
  const lastUpdatedId = 'output_last_updated';
  const newCoursesId = 'output_new_courses';
  const updatedCoursesId = 'output_updated_courses';
  const deletedCoursesId = 'output_deleted_courses';
  const deletedCSSClass = 'deleted_course';
  const reduceNode = d => d.innerText;
  const transformRecord = d => nodeListToArray( d.querySelectorAll( 'td' ) );
  const getHeaders = selector => nodeListToArray( document.querySelectorAll( selector ) ).map( reduceNode );
  const nodeListToArray = nodeList => Array.prototype.slice.call( nodeList );
  const filterRecordDom = d => !( d.classList.contains( deletedCSSClass ) );
  const createKeyValue = ( keys, values ) => {

    if ( keys.length !== values.length ) {

      return null;

    }

    const obj = {};

    for ( let i = 0; i < keys.length; i++ ) {

      obj[ keys[ i ] ] = values[ i ];

    }

    return obj;

  };

  const convertToDict = ( arr, keyField ) => {

    const obj = {};

    for ( let i = 0; i < arr.length; i++ ) {

    // if( arr[i] === null ) { continue; }

      const key = arr[ i ][ keyField ];
      obj[ key ] = arr[ i ];

    }

    return obj;

  };


  let headers;
  let getHeaderIndex = key => headers.findIndex( d => d === key );

  let observer = new MutationObserver( (mutationList, observer) => {

    mutationList.forEach( mutation => {

      if(mutation.target.className == 'reportTitle') {

        main();
        observer.disconnect();

      }

    });
  });

  observer.observe(document, { childList: true, subtree: true, attributes: true, characterData: true });

  function main() {

  headers = getHeaders( headerSelector );
    const saveBtn = createBtn( 'Save Records', e => {

      e.preventDefault();

      const data = {

        date: Date.now(),
        records: getRecords()

      };

      localStorage.setItem( localStorageId, JSON.stringify( data ) );

    } );

    const checkBtn = createBtn( 'Check Changes', e => {

      e.preventDefault();

      const added = {};
      const updates = {};
      const deletions = {};
      const storageData = JSON.parse( localStorage.getItem( localStorageId ) );
      const pastData = storageData.records;
      const lastUpdatedDate = new Date( storageData.date ).toDateString();

      if ( !pastData ) {

        console.log( 'No past data to compare to.' );
        return;

      }

      const currentData = getRecords();

      for ( const recordKey in pastData ) {

        const pastRecord = pastData[ recordKey ];
        const currentRecord = currentData[ recordKey ];

        if ( currentRecord ) {

          // assumes same keys in both records
          for ( const fieldKey in currentRecord ) {

            if ( currentRecord[ fieldKey ] !== pastRecord[ fieldKey ] ) {

              if ( !updates[ recordKey ] ) {

                updates[ recordKey ] = {};

              }
              // Update has occured
              updates[ recordKey ][ fieldKey ] = {

                old: pastRecord[ fieldKey ],
                current: currentRecord[ fieldKey ]

              };

            }

          }

          // remove current record
          if ( !updates[ recordKey ] ) {

            delete updates[ recordKey ];

          }

          delete currentData[ recordKey ];

        } else {

          // Record not found. Removed between past and current.
          deletions[ recordKey ] = pastData[ recordKey ];

        }

        // remove past record
        delete pastData[ recordKey ];

      }


      for ( const recordKey in currentData ) {

        // remaining records. they are new
        const currentRecord = currentData[ recordKey ];

        added[ recordKey ] = {};
        for ( const fieldKey in currentRecord ) {

          added[ recordKey ][ fieldKey ] = currentRecord[ fieldKey ];

        }

      }

      const nodes = getRecordNodes();
      let addedCount = 0;
      let updatedCount = 0;
      let deleteCount = 0;

      for ( const recordKey in added ) {

        const updatedFields = added[ recordKey ];

        const idIndex = getHeaderIndex( recordId );
        const node = nodes.find( d => nodeListToArray( d.querySelectorAll( 'td' ) )[ idIndex ].innerText === recordKey );
        addedCount++;

        for ( const fieldKey in updatedFields ) {

          const fieldIndex = getHeaderIndex( fieldKey );
          const fieldNode = nodeListToArray( node.querySelectorAll( 'td' ) )[ fieldIndex ];
          addedNodeStyle( fieldNode );

        }

      }

      for ( const recordKey in updates ) {

        const updatedFields = updates[ recordKey ];

        const idIndex = getHeaderIndex( recordId );
        const node = nodes.find( d => nodeListToArray( d.querySelectorAll( 'td' ) )[ idIndex ].innerText === recordKey );
        updatedCount++;

        for ( const fieldKey in updatedFields ) {

          const fieldIndex = getHeaderIndex( fieldKey );
          const fieldNode = nodeListToArray( node.querySelectorAll( 'td' ) )[ fieldIndex ];
          updateNodeStyle( fieldNode );

        }

      }

      for ( const recordKey in deletions ) {

        const deletedFields = deletions[ recordKey ];
        const recordNode = document.createElement( 'tr' );
        deleteCount++;

        for ( let i = 0; i < headers.length; i++ ) {

          const fieldNode = document.createElement( 'td' );
          fieldNode.appendChild( document.createTextNode( deletedFields[ headers[ i ] ] ) );
          deletedNodeStyle( fieldNode );
          recordNode.appendChild( fieldNode );

        }

        recordNode.classList.add( deletedCSSClass );

        document.querySelector( '.reportTable > tbody' ).appendChild( recordNode );

      }

      lastUpdatedId
      document.querySelector( `#${ lastUpdatedId }` ).innerHTML = `Comparing against records from: ${ lastUpdatedDate }`;
      document.querySelector( `#${ newCoursesId }` ).innerHTML = `${ addedCount } new courses.`;
      document.querySelector( `#${ updatedCoursesId }` ).innerHTML = `${ updatedCount } updated courses.`;
      document.querySelector( `#${ deletedCoursesId }` ).innerHTML = `${ deleteCount } deleted courses. Can be found at the bottom.`;
      console.log( 'New Courses', added );
      console.log( 'Updated Courses', updates );
      console.log( 'Deleted Courses', deletions );


    } );

    const parentSelector = '.reportsMetricsHeader';
    const parent = document.querySelector( parentSelector );
    parent.insertBefore( buildOutput(), parent.firstChild );
    parent.insertBefore( saveBtn, parent.firstChild );
    parent.insertBefore( checkBtn, parent.firstChild );


  }

  function buildOutput() {

    const wrapper = document.createElement( 'div' );
    const newCourses = document.createElement( 'p' );
    const updatedCourses = document.createElement( 'p' );
    const deletedCourses = document.createElement( 'p' );
    const lastUpdated = document.createElement( 'p' );

    lastUpdated.id = lastUpdatedId;
    newCourses.id = newCoursesId;
    updatedCourses.id = updatedCoursesId;
    deletedCourses.id = deletedCoursesId;

    wrapper.setAttribute('style', 'margin: 25px')
  wrapper.appendChild( lastUpdated );
    wrapper.appendChild( newCourses );
    wrapper.appendChild( updatedCourses );
    wrapper.appendChild( deletedCourses );

    return wrapper;

  }

  function addedNodeStyle( node ) {

    node.style.backgroundColor = '#4caf50';

  }

  function updateNodeStyle( node ) {

    node.style.backgroundColor = '#ff9800';

  }

  function deletedNodeStyle( node ) {

    node.style.backgroundColor = '#c94036';
    node.style.color = '#DDDDDD';

  }

  function createBtn( title, clickAction ) {

    const btn = document.createElement( 'button' );
  btn.setAttribute('style', 'margin: 15px 0 0 25px')
    btn.appendChild( document.createTextNode( title ) );
    btn.addEventListener( 'click', clickAction );

    return btn;

  }

  function getRecordNodes() {

    const recordsSelector = '.reportTable > tbody > tr.dataRow';

    return nodeListToArray( document.querySelectorAll( recordsSelector ) )
      .filter( filterRecordDom );

  }

  function getRecords() {

  // const recordsSelector = '.reportTable > tbody > tr.dataRow';

    const records = getRecordNodes()
      .map( transformRecord )
      .map( d => d.map( reduceNode ) )
      .map( d => createKeyValue( headers, d ) );

    return convertToDict( records, recordId );

  }

} )();